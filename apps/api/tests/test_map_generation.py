from __future__ import annotations

import json
from collections.abc import Iterator
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_embedding_provider, get_llm_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
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


def _create_goal(client: TestClient) -> str:
    response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": "Learn Japanese for travel",
            "description": "Need a focused route",
            "category": "language",
            "success_criteria": "Handle food orders and directions in Japan",
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
