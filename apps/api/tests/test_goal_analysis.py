from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_llm_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.infrastructure.llm_providers import StubPathwayProvider
from lifemap_api.main import create_app


class FakeAnalysisProvider:
    is_deterministic_fallback = False

    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.calls: list[list[dict[str, str]]] = []

    def generate_structured_json(
        self,
        *,
        messages: list[dict[str, str]],
        json_schema: dict,
        schema_name: str,
    ) -> str:
        del json_schema
        self.calls.append(messages)
        assert schema_name == "pathway_goal_analysis"
        return json.dumps(self.payload, ensure_ascii=False)


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("LIFEMAP_SQLITE_URL", f"sqlite:///{tmp_path / 'analysis-test.db'}")
    monkeypatch.setenv("LIFEMAP_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("LIFEMAP_LANCEDB_URI", str(tmp_path / "lancedb"))
    get_settings.cache_clear()
    build_engine.cache_clear()

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    build_engine.cache_clear()
    get_settings.cache_clear()


def _create_goal(client: TestClient) -> str:
    response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": "영어를 원어민과 자연스럽게 대화 가능한 수준까지 학습",
            "description": "실전 회화와 자연스러운 리액션을 함께 키우고 싶다.",
            "category": "language",
            "success_criteria": "원어민과 30분 이상 막혀도 자연스럽게 복구하며 대화한다.",
            "status": "active",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _provider_payload(goal_id: str) -> dict:
    return {
        "goal_id": goal_id,
        "analysis_summary": "사용자의 회화 목표를 상황, 피드백, 유지 가능한 연습 루프로 나누어 확인합니다.",
        "resource_dimensions": [
            {
                "id": "speaking_context",
                "label": "Speaking context",
                "kind": "practice",
                "value_type": "qualitative",
                "question": "원어민과 어떤 상황에서 가장 먼저 자연스럽게 대화하고 싶나요?",
                "relevance_reason": "대화 상황에 따라 필요한 표현, 리스닝 난도, 연습 루트가 달라집니다.",
            },
            {
                "id": "feedback_loop",
                "label": "Feedback loop",
                "kind": "support",
                "value_type": "qualitative",
                "question": "발음이나 표현을 교정받을 수 있는 사람이나 서비스가 있나요?",
                "relevance_reason": "회화 목표는 피드백 루프 유무에 따라 독학 route와 교정 route가 갈립니다.",
            },
        ],
        "research_questions": [
            "영어 회화 원어민 대화 실전 연습 피드백 루틴",
            "adult English speaking fluency feedback practice routine",
        ],
        "followup_questions": [
            {
                "id": "speaking_context",
                "label": "Speaking context",
                "question": "원어민과 어떤 상황에서 가장 먼저 자연스럽게 대화하고 싶나요?",
                "why_needed": "대화 상황에 따라 필요한 표현, 리스닝 난도, 연습 루트가 달라집니다.",
                "answer_type": "qualitative",
                "required": True,
                "maps_to": ["speaking_context"],
            },
            {
                "id": "feedback_loop",
                "label": "Feedback loop",
                "question": "발음이나 표현을 교정받을 수 있는 사람이나 서비스가 있나요?",
                "why_needed": "회화 목표는 피드백 루프 유무에 따라 독학 route와 교정 route가 갈립니다.",
                "answer_type": "qualitative",
                "required": True,
                "maps_to": ["feedback_loop"],
            },
        ],
        "research_plan": {
            "summary": "회화 실전 루틴과 피드백 경로를 조사합니다.",
            "collection_targets": [
                {
                    "id": "speaking_routines",
                    "label": "실전 회화 루틴 사례",
                    "layer": "lived_experience",
                    "search_intent": "비슷한 목표에서 유지된 연습 루틴과 실패 지점을 찾는다.",
                    "example_queries": ["영어 회화 원어민 대화 루틴 후기"],
                    "preferred_collectors": ["crawl4ai"],
                    "reason": "현실적인 checkpoint와 route 분기를 만들기 위해 필요합니다.",
                }
            ],
        },
    }


def test_goal_analysis_returns_followup_questions_and_collection_plan(
    client: TestClient,
) -> None:
    goal_id = _create_goal(client)
    provider = FakeAnalysisProvider(_provider_payload(goal_id))
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/analysis")

    assert response.status_code == 200
    payload = response.json()
    assert payload["goal_id"] == goal_id
    assert len(payload["followup_questions"]) >= 2
    assert payload["research_plan"]["collection_targets"]
    assert any(
        "수기" in target["label"] or target["layer"] == "lived_experience"
        for target in payload["research_plan"]["collection_targets"]
    )
    assert any(
        "crawl4ai" in target["preferred_collectors"]
        for target in payload["research_plan"]["collection_targets"]
    )
    assert len(payload["research_questions"]) >= len(payload["research_plan"]["collection_targets"])
    assert provider.calls


def test_goal_analysis_uses_provider_and_normalizes_missing_plan_details(
    client: TestClient,
) -> None:
    goal_id = _create_goal(client)
    provider = FakeAnalysisProvider(
        {
            "goal_id": "wrong_goal",
            "analysis_summary": "사용자의 목표를 먼저 인터뷰하고 공개 자료를 분리 조사합니다.",
            "resource_dimensions": [
                {
                    "id": "speaking_context",
                    "label": "Speaking context",
                    "kind": "practice",
                    "value_type": "qualitative",
                    "question": "원어민과 어떤 상황에서 대화하고 싶나요?",
                    "relevance_reason": "대화 상황에 따라 자료와 route가 달라집니다.",
                }
            ],
            "research_questions": [],
            "followup_questions": [],
            "research_plan": None,
        }
    )
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/analysis")

    assert response.status_code == 200
    payload = response.json()
    assert payload["goal_id"] == goal_id
    assert payload["followup_questions"][0]["id"] == "speaking_context"
    assert payload["research_plan"]["collection_targets"]
    assert payload["research_questions"]
    assert "Analyze this Pathway goal" in provider.calls[0][-1]["content"]


def test_goal_analysis_rejects_deterministic_stub_provider(client: TestClient) -> None:
    goal_id = _create_goal(client)
    client.app.dependency_overrides[get_llm_provider] = lambda: StubPathwayProvider()

    response = client.post(f"/goals/{goal_id}/analysis")

    assert response.status_code == 503
    assert "requires a real structured LLM provider" in response.json()["detail"]
