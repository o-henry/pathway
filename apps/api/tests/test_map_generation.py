from __future__ import annotations

import json
from collections.abc import Iterator
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_embedding_provider, get_llm_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.infrastructure.llm_providers import StubPathwayProvider
from lifemap_api.main import create_app

from .fake_embeddings import FakeEmbeddingProvider
from .graph_bundle_fixture import build_valid_graph_bundle


class FakeLLMProvider:
    def __init__(self, responses: list[str]) -> None:
        self._responses = responses
        self.calls: list[list[dict[str, str]]] = []

    def generate_structured_json(
        self,
        *,
        messages: list[dict[str, str]],
        json_schema: dict,
        schema_name: str,
    ) -> str:
        del json_schema, schema_name
        self.calls.append(deepcopy(messages))
        if len(self._responses) == 1:
            return self._responses[0]
        return self._responses.pop(0)


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("LIFEMAP_SQLITE_URL", f"sqlite:///{tmp_path / 'generation-test.db'}")
    monkeypatch.setenv("LIFEMAP_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("LIFEMAP_LANCEDB_URI", str(tmp_path / "lancedb"))
    get_settings.cache_clear()
    build_engine.cache_clear()

    app = create_app()
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    with TestClient(app) as test_client:
        yield test_client

    build_engine.cache_clear()
    get_settings.cache_clear()


def _create_goal(
    client: TestClient,
    *,
    title: str = "Learn Japanese for travel",
    description: str = "Need a focused route",
    category: str = "language",
    success_criteria: str = "Handle food orders and directions in Japan",
) -> str:
    response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": title,
            "description": description,
            "category": category,
            "success_criteria": success_criteria,
            "status": "active",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _put_profile(client: TestClient) -> None:
    response = client.put(
        "/profiles/default",
        json={
            "display_name": "Henry",
            "weekly_free_hours": 5,
            "monthly_budget_amount": 100000,
            "monthly_budget_currency": "KRW",
            "energy_level": "medium",
            "preference_tags": ["solo", "easily_bored"],
            "constraints": {"timebox": "evenings"},
        },
    )
    assert response.status_code == 200


def _put_profile_custom(
    client: TestClient,
    *,
    weekly_free_hours: float,
    monthly_budget_amount: float,
    energy_level: str,
) -> None:
    response = client.put(
        "/profiles/default",
        json={
            "display_name": "Henry",
            "weekly_free_hours": weekly_free_hours,
            "monthly_budget_amount": monthly_budget_amount,
            "monthly_budget_currency": "KRW",
            "energy_level": energy_level,
            "preference_tags": ["solo"],
            "constraints": {"timebox": "evenings"},
        },
    )
    assert response.status_code == 200


def _create_manual_source(client: TestClient, *, title: str, content_text: str) -> str:
    response = client.post(
        "/sources/manual",
        json={
            "title": title,
            "content_text": content_text,
            "source_type": "manual_note",
            "metadata": {"origin": "test"},
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_generate_map_endpoint_creates_valid_map(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)
    _create_manual_source(
        client,
        title="Speaking checkpoint note",
        content_text=(
            "일본어 여행 회화는 초반부터 말하기 연습을 섞어야 오래 간다. "
            "주 5시간 이하 학습자는 문법만 하면 쉽게 질린다."
        ),
    )

    bundle = build_valid_graph_bundle()
    bundle["map"]["goal_id"] = goal_id
    bundle["map"]["title"] = "Generated Japanese Travel Map"
    bundle["nodes"][1]["evidence_refs"] = ["ev_rag_001"]
    bundle["evidence"] = [
        {
            "id": "ev_rag_001",
            "source_id": "src_placeholder",
            "title": "Placeholder",
            "quote_or_summary": "Placeholder",
            "url": None,
            "reliability": "placeholder",
        }
    ]
    provider = FakeLLMProvider([json.dumps(bundle, ensure_ascii=False)])
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 201
    payload = response.json()
    assert payload["goal_id"] == goal_id
    assert payload["title"] == "Generated Japanese Travel Map"
    assert payload["graph_bundle"]["map"]["goal_id"] == goal_id
    assert payload["graph_bundle"]["bundle_id"] == "gb_test_001"
    assert payload["graph_bundle"]["evidence"][0]["id"] == "ev_rag_001"
    assert payload["graph_bundle"]["evidence"][0]["title"] == "Speaking checkpoint note"
    assert len(provider.calls) == 1
    assert '"id": "ev_rag_001"' in provider.calls[0][-1]["content"]

    client.app.dependency_overrides.clear()


def test_generate_map_endpoint_repairs_invalid_first_response(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)
    _create_manual_source(
        client,
        title="Budget-friendly speaking note",
        content_text=(
            "예산이 적을수록 독학만 하지 말고 "
            "짧은 회화 출력 루프를 섞는 편이 지속성이 높다."
        ),
    )

    broken_bundle = build_valid_graph_bundle()
    broken_bundle["map"]["goal_id"] = goal_id
    broken_bundle["nodes"][1]["evidence_refs"] = ["ev_fake_999"]
    broken_bundle["evidence"] = [
        {
            "id": "ev_fake_999",
            "source_id": "src_fake",
            "title": "Fake evidence",
            "quote_or_summary": "Invented source",
            "url": None,
            "reliability": "imagined",
        }
    ]

    repaired_bundle = build_valid_graph_bundle()
    repaired_bundle["map"]["goal_id"] = goal_id
    repaired_bundle["map"]["title"] = "Repaired Japanese Travel Map"
    repaired_bundle["nodes"][1]["evidence_refs"] = ["ev_rag_001"]
    repaired_bundle["evidence"] = [
        {
            "id": "ev_rag_001",
            "source_id": "src_placeholder",
            "title": "Placeholder",
            "quote_or_summary": "Placeholder",
            "url": None,
            "reliability": "placeholder",
        }
    ]

    provider = FakeLLMProvider(
        [
            json.dumps(broken_bundle, ensure_ascii=False),
            json.dumps(repaired_bundle, ensure_ascii=False),
        ]
    )
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 201
    payload = response.json()
    assert payload["title"] == "Repaired Japanese Travel Map"
    assert len(provider.calls) == 2
    assert "Repair the previous JSON" in provider.calls[1][-1]["content"]
    assert "outside the retrieved evidence packet" in provider.calls[1][-1]["content"]

    client.app.dependency_overrides.clear()


def test_generate_map_endpoint_rejects_nonexistent_evidence_refs(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)
    _create_manual_source(
        client,
        title="Speaking habit note",
        content_text="회화 목표면 근거 기반으로 출력 루프를 빨리 붙이는 편이 좋다.",
    )

    invalid_bundle = build_valid_graph_bundle()
    invalid_bundle["map"]["goal_id"] = goal_id
    invalid_bundle["nodes"][1]["evidence_refs"] = ["ev_fake_999"]
    invalid_bundle["evidence"] = [
        {
            "id": "ev_fake_999",
            "source_id": "src_fake",
            "title": "Invented evidence",
            "quote_or_summary": "This evidence does not exist in the packet.",
            "url": None,
            "reliability": "imagined",
        }
    ]

    provider = FakeLLMProvider([json.dumps(invalid_bundle, ensure_ascii=False)])
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 422
    assert "outside the retrieved evidence packet" in response.json()["detail"]

    client.app.dependency_overrides.clear()


def test_stub_provider_varies_language_goal_topology_and_preserves_grounding(client: TestClient) -> None:
    _put_profile_custom(
        client,
        weekly_free_hours=10,
        monthly_budget_amount=120000,
        energy_level="medium",
    )
    goal_id = _create_goal(
        client,
        title="일본어를 원어민과 대화할 수준까지 학습",
        description="회화 위주로 실전 대화가 가능해지고 싶다.",
        category="language",
        success_criteria="원어민과 30분 동안 막혀도 일본어로 복구하며 대화를 이어간다.",
    )
    _create_manual_source(
        client,
        title="Speaking loop note",
        content_text="회화 목표면 초반부터 말하기 루프를 만들고 복기해야 유지된다.",
    )
    _create_manual_source(
        client,
        title="Tutor feedback note",
        content_text="주기적인 피드백이 있을수록 잘못 굳는 표현을 빨리 고친다.",
    )
    _create_manual_source(
        client,
        title="Immersion environment note",
        content_text="실제 원어민 반응을 받는 환경이 있어야 회화 복구력이 빨리 붙는다.",
    )

    client.app.dependency_overrides[get_llm_provider] = lambda: StubPathwayProvider()
    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 201
    graph_bundle = response.json()["graph_bundle"]
    labels = {node["label"] for node in graph_bundle["nodes"]}

    assert len(graph_bundle["nodes"]) >= 8
    assert "주간 회화 루프" in labels
    assert "원어민 노출 환경" in labels
    assert "30분 대화 마일스톤" in labels
    evidence_titles = {item["title"] for item in graph_bundle["evidence"]}
    assert {"Speaking loop note", "Tutor feedback note", "Immersion environment note"} & evidence_titles
    assert any(node_type["id"] == "practice_system" for node_type in graph_bundle["ontology"]["node_types"])
    assert "직행 루트" not in labels

    client.app.dependency_overrides.clear()


def test_stub_provider_changes_node_count_for_non_language_goal(client: TestClient) -> None:
    _put_profile_custom(
        client,
        weekly_free_hours=4,
        monthly_budget_amount=20000,
        energy_level="high",
    )
    goal_id = _create_goal(
        client,
        title="백엔드 포트폴리오로 취업하기",
        description="실무형 포트폴리오와 인터뷰 준비를 병행하고 싶다.",
        category="career",
        success_criteria="지원 가능한 포트폴리오 2개와 인터뷰 대응 스토리를 만든다.",
    )
    _create_manual_source(
        client,
        title="Portfolio evidence",
        content_text="직무 전환 목표는 직접 지원 루트와 포트폴리오 보강 루트를 분리해 관리하는 편이 좋다.",
    )
    _create_manual_source(
        client,
        title="Interview evidence",
        content_text="면접 스토리 보강은 빠른 지원 루트의 실패 비용을 낮춘다.",
    )

    client.app.dependency_overrides[get_llm_provider] = lambda: StubPathwayProvider()
    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 201
    graph_bundle = response.json()["graph_bundle"]
    labels = {node["label"] for node in graph_bundle["nodes"]}

    assert len(graph_bundle["nodes"]) == 6
    assert "직접 도전 루트" in labels
    assert "포트폴리오 보강 루트" in labels
    assert "주간 회화 루프" not in labels
    assert all(node_type["id"] != "practice_system" for node_type in graph_bundle["ontology"]["node_types"])

    client.app.dependency_overrides.clear()
