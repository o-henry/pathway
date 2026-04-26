from __future__ import annotations

import json
from collections.abc import Iterator
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_embedding_provider, get_llm_provider
from lifemap_api.config import get_settings
from lifemap_api.domain.graph_bundle import GraphBundle
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.infrastructure.llm_providers import StubPathwayProvider, _to_codex_output_schema
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


def _assert_strict_objects(schema: object) -> None:
    if isinstance(schema, dict):
        if schema.get("type") == "object" or "properties" in schema:
            assert schema.get("additionalProperties") is False
        for value in schema.values():
            _assert_strict_objects(value)
    elif isinstance(schema, list):
        for value in schema:
            _assert_strict_objects(value)


def test_codex_graph_bundle_schema_is_strict_for_nested_objects() -> None:
    schema = _to_codex_output_schema(GraphBundle.model_json_schema())

    _assert_strict_objects(schema)
    node_schema = schema["properties"]["nodes"]["items"]
    assert node_schema["properties"]["style_overrides"]["additionalProperties"] is False
    assert node_schema["properties"]["data"]["additionalProperties"] is False


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


def _build_route_atlas_bundle(goal_id: str, *, title: str = "Generated Route Atlas") -> dict:
    bundle = build_valid_graph_bundle()
    bundle["map"]["goal_id"] = goal_id
    bundle["map"]["title"] = title
    bundle["ontology"]["node_types"].extend(
        [
            {
                "id": "checkpoint",
                "label": "Checkpoint",
                "description": "A route validation checkpoint",
                "default_style": {
                    "tone": "sky",
                    "shape": "rounded_card",
                    "accent": "sketch_border",
                },
                "fields": [],
            },
            {
                "id": "risk",
                "label": "Risk",
                "description": "A route risk or failure mode",
                "default_style": {
                    "tone": "mist",
                    "shape": "rounded_card",
                    "accent": "sketch_border",
                },
                "fields": [],
            },
            {
                "id": "opportunity_cost",
                "label": "Opportunity Cost",
                "description": "Cost of not choosing another path",
                "default_style": {
                    "tone": "mist",
                    "shape": "rounded_card",
                    "accent": "sketch_border",
                },
                "fields": [],
            },
            {
                "id": "switch_condition",
                "label": "Switch Condition",
                "description": "When the user should change routes",
                "default_style": {
                    "tone": "sky",
                    "shape": "rounded_card",
                    "accent": "sketch_border",
                },
                "fields": [],
            },
        ]
    )
    route_nodes = [
        {
            "id": "n_route_output",
            "type": "route_choice",
            "label": "Speaking-first route",
            "summary": "Start with output practice and accept early friction.",
            "data": {"fit_reason": "Builds conversation tolerance quickly."},
            "scores": {
                "time_load": 0.62,
                "money_load": 0.2,
                "energy_load": 0.62,
                "uncertainty": 0.42,
            },
            "evidence_refs": ["ev_rag_001"],
            "assumption_refs": ["as_time"],
            "position": {"x": 240, "y": 80},
            "style_overrides": {},
        },
        {
            "id": "n_route_tutor",
            "type": "route_choice",
            "label": "Tutor feedback route",
            "summary": "Pay for corrections to reduce wrong-pattern drift.",
            "data": {"fit_reason": "Useful when solo practice gets stuck."},
            "scores": {
                "time_load": 0.5,
                "money_load": 0.55,
                "energy_load": 0.46,
                "uncertainty": 0.3,
            },
            "evidence_refs": [],
            "assumption_refs": ["as_time"],
            "position": {"x": 240, "y": 180},
            "style_overrides": {},
        },
        {
            "id": "n_route_micro",
            "type": "route_choice",
            "label": "Micro-practice route",
            "summary": "Keep a tiny daily speaking loop when weeks get messy.",
            "data": {"fit_reason": "Protects momentum under low time."},
            "scores": {
                "time_load": 0.22,
                "money_load": 0.08,
                "energy_load": 0.22,
                "uncertainty": 0.38,
            },
            "evidence_refs": [],
            "assumption_refs": ["as_time"],
            "position": {"x": 240, "y": 280},
            "style_overrides": {},
        },
        {
            "id": "n_route_exchange",
            "type": "route_choice",
            "label": "Language-exchange route",
            "summary": "Use low-cost human reaction as the pressure test.",
            "data": {"fit_reason": "Adds social practice without a large budget."},
            "scores": {
                "time_load": 0.48,
                "money_load": 0.12,
                "energy_load": 0.58,
                "uncertainty": 0.52,
            },
            "evidence_refs": [],
            "assumption_refs": ["as_time"],
            "position": {"x": 240, "y": 380},
            "style_overrides": {},
        },
        {
            "id": "n_route_fallback",
            "type": "route_choice",
            "label": "Fallback scope route",
            "summary": "Shrink conversation scope instead of quitting when output collapses.",
            "data": {"fit_reason": "Preserves the goal during rough weeks."},
            "scores": {
                "time_load": 0.3,
                "money_load": 0.1,
                "energy_load": 0.26,
                "uncertainty": 0.28,
            },
            "evidence_refs": [],
            "assumption_refs": ["as_time"],
            "position": {"x": 720, "y": 360},
            "style_overrides": {},
        },
    ]
    support_nodes = [
        {
            "id": "n_checkpoint",
            "type": "checkpoint",
            "label": "Two-week checkpoint",
            "summary": "Measure whether the chosen route produces real speaking attempts.",
            "data": {},
            "scores": {
                "time_load": 0.2,
                "money_load": 0.1,
                "energy_load": 0.24,
                "uncertainty": 0.2,
            },
            "evidence_refs": [],
            "assumption_refs": [],
            "position": {"x": 480, "y": 140},
            "style_overrides": {},
        },
        {
            "id": "n_risk",
            "type": "risk",
            "label": "Input-only risk",
            "summary": "The map weakens if study becomes passive consumption.",
            "data": {},
            "scores": {
                "time_load": 0.35,
                "money_load": 0.08,
                "energy_load": 0.5,
                "uncertainty": 0.48,
            },
            "evidence_refs": [],
            "assumption_refs": [],
            "position": {"x": 480, "y": 240},
            "style_overrides": {},
        },
        {
            "id": "n_opportunity",
            "type": "opportunity_cost",
            "label": "Delayed exposure cost",
            "summary": "Waiting to speak delays recovery skill and confidence data.",
            "data": {},
            "scores": {
                "time_load": 0.3,
                "money_load": 0.18,
                "energy_load": 0.42,
                "uncertainty": 0.42,
            },
            "evidence_refs": [],
            "assumption_refs": [],
            "position": {"x": 480, "y": 340},
            "style_overrides": {},
        },
        {
            "id": "n_switch",
            "type": "switch_condition",
            "label": "Switch after six weeks",
            "summary": "Change route when speaking sessions disappear twice.",
            "data": {},
            "scores": {
                "time_load": 0.18,
                "money_load": 0.08,
                "energy_load": 0.2,
                "uncertainty": 0.32,
            },
            "evidence_refs": [],
            "assumption_refs": [],
            "position": {"x": 600, "y": 260},
            "style_overrides": {},
        },
        {
            "id": "n_milestone",
            "type": "checkpoint",
            "label": "Fifteen-minute conversation",
            "summary": "A later checkpoint for route viability.",
            "data": {},
            "scores": {
                "time_load": 0.32,
                "money_load": 0.12,
                "energy_load": 0.42,
                "uncertainty": 0.24,
            },
            "evidence_refs": [],
            "assumption_refs": [],
            "position": {"x": 760, "y": 160},
            "style_overrides": {},
        },
    ]
    reference_route = {
        **bundle["nodes"][1],
        "id": "n_route_reference",
        "label": "Self-study reference route",
        "summary": (
            "A low-cost route kept visible for comparison rather than treated as the only plan."
        ),
        "evidence_refs": [],
        "position": {"x": 240, "y": 480},
    }
    bundle["nodes"] = [bundle["nodes"][0], *route_nodes, *support_nodes, reference_route]
    bundle["edges"] = [
        {
            "id": "e_goal_output",
            "type": "progresses_to",
            "source": "n_goal",
            "target": "n_route_output",
            "label": "fast output",
        },
        {
            "id": "e_goal_tutor",
            "type": "progresses_to",
            "source": "n_goal",
            "target": "n_route_tutor",
            "label": "guided",
        },
        {
            "id": "e_goal_micro",
            "type": "progresses_to",
            "source": "n_goal",
            "target": "n_route_micro",
            "label": "low friction",
        },
        {
            "id": "e_goal_exchange",
            "type": "progresses_to",
            "source": "n_goal",
            "target": "n_route_exchange",
            "label": "social",
        },
        {
            "id": "e_goal_reference",
            "type": "progresses_to",
            "source": "n_goal",
            "target": "n_route_reference",
            "label": "comparison",
        },
        {
            "id": "e_goal_opportunity",
            "type": "progresses_to",
            "source": "n_goal",
            "target": "n_opportunity",
            "label": "cost",
        },
        {
            "id": "e_output_checkpoint",
            "type": "progresses_to",
            "source": "n_route_output",
            "target": "n_checkpoint",
        },
        {
            "id": "e_tutor_checkpoint",
            "type": "progresses_to",
            "source": "n_route_tutor",
            "target": "n_checkpoint",
        },
        {
            "id": "e_micro_checkpoint",
            "type": "progresses_to",
            "source": "n_route_micro",
            "target": "n_checkpoint",
        },
        {
            "id": "e_exchange_risk",
            "type": "progresses_to",
            "source": "n_route_exchange",
            "target": "n_risk",
        },
        {
            "id": "e_checkpoint_switch",
            "type": "progresses_to",
            "source": "n_checkpoint",
            "target": "n_switch",
        },
        {"id": "e_risk_switch", "type": "progresses_to", "source": "n_risk", "target": "n_switch"},
        {
            "id": "e_switch_fallback",
            "type": "progresses_to",
            "source": "n_switch",
            "target": "n_route_fallback",
        },
        {
            "id": "e_checkpoint_milestone",
            "type": "progresses_to",
            "source": "n_checkpoint",
            "target": "n_milestone",
        },
    ]
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
    return bundle


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

    bundle = _build_route_atlas_bundle(goal_id, title="Generated Japanese Travel Map")
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
            "예산이 적을수록 독학만 하지 말고 짧은 회화 출력 루프를 섞는 편이 지속성이 높다."
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

    repaired_bundle = _build_route_atlas_bundle(goal_id, title="Repaired Japanese Travel Map")

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


def test_generate_map_endpoint_repairs_sparse_route_atlas(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)
    _create_manual_source(
        client,
        title="Speaking route breadth note",
        content_text="회화 목표는 독학, 튜터, 언어교환, 짧은 출력 루트를 나눠 비교해야 한다.",
    )

    sparse_bundle = build_valid_graph_bundle()
    sparse_bundle["map"]["goal_id"] = goal_id
    sparse_bundle["nodes"][1]["evidence_refs"] = ["ev_rag_001"]
    sparse_bundle["evidence"] = [
        {
            "id": "ev_rag_001",
            "source_id": "src_placeholder",
            "title": "Placeholder",
            "quote_or_summary": "Placeholder",
            "url": None,
            "reliability": "placeholder",
        }
    ]
    repaired_bundle = _build_route_atlas_bundle(goal_id, title="Expanded Route Atlas")
    provider = FakeLLMProvider(
        [
            json.dumps(sparse_bundle, ensure_ascii=False),
            json.dumps(repaired_bundle, ensure_ascii=False),
        ]
    )
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 201
    assert response.json()["title"] == "Expanded Route Atlas"
    assert len(provider.calls) == 2
    assert "route atlas is too sparse" in provider.calls[1][-1]["content"]
    assert "expand the graph" in provider.calls[1][-1]["content"]

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


def test_stub_provider_varies_language_goal_topology_and_preserves_grounding(
    client: TestClient,
) -> None:
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

    assert len(graph_bundle["nodes"]) >= 12
    assert "주간 회화 루프" in labels
    assert "원어민 노출 환경" in labels
    assert "30분 대화 마일스톤" in labels
    assert "마이크로 회화 루트" in labels
    assert "언어교환 루트" in labels
    evidence_titles = {item["title"] for item in graph_bundle["evidence"]}
    assert {
        "Speaking loop note",
        "Tutor feedback note",
        "Immersion environment note",
    } & evidence_titles
    assert any(
        node_type["id"] == "practice_system" for node_type in graph_bundle["ontology"]["node_types"]
    )
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
        content_text=(
            "직무 전환 목표는 직접 지원 루트와 포트폴리오 보강 루트를 "
            "분리해 관리하는 편이 좋다."
        ),
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

    assert len(graph_bundle["nodes"]) >= 12
    assert len(graph_bundle["edges"]) >= 10
    assert "직접 도전 루트" in labels
    assert "포트폴리오 보강 루트" in labels
    assert "작은 프로젝트 루트" in labels
    assert "네트워크 루트" in labels
    assert "전환 판단 조건" in labels
    assert "주간 회화 루프" not in labels
    assert all(
        node_type["id"] != "practice_system" for node_type in graph_bundle["ontology"]["node_types"]
    )

    client.app.dependency_overrides.clear()
