from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_llm_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.main import create_app


class FakeAnalysisProvider:
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


def test_goal_analysis_returns_followup_questions_and_collection_plan(
    client: TestClient,
) -> None:
    goal_id = _create_goal(client)

    response = client.post(f"/goals/{goal_id}/analysis")

    assert response.status_code == 200
    payload = response.json()
    assert payload["goal_id"] == goal_id
    assert len(payload["followup_questions"]) >= 4
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
