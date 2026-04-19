from __future__ import annotations

import json
from collections.abc import Iterator
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_llm_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.main import create_app

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
    get_settings.cache_clear()
    build_engine.cache_clear()

    app = create_app()
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


def test_generate_map_endpoint_creates_valid_map(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)

    bundle = build_valid_graph_bundle()
    bundle["map"]["goal_id"] = goal_id
    bundle["map"]["title"] = "Generated Japanese Travel Map"
    provider = FakeLLMProvider([json.dumps(bundle, ensure_ascii=False)])
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 201
    payload = response.json()
    assert payload["goal_id"] == goal_id
    assert payload["title"] == "Generated Japanese Travel Map"
    assert payload["graph_bundle"]["map"]["goal_id"] == goal_id
    assert payload["graph_bundle"]["bundle_id"] == "gb_test_001"
    assert len(provider.calls) == 1

    client.app.dependency_overrides.clear()


def test_generate_map_endpoint_repairs_invalid_first_response(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)

    broken_bundle = build_valid_graph_bundle()
    broken_bundle["map"]["goal_id"] = goal_id
    broken_bundle["edges"][0]["target"] = "missing_node"

    repaired_bundle = build_valid_graph_bundle()
    repaired_bundle["map"]["goal_id"] = goal_id
    repaired_bundle["map"]["title"] = "Repaired Japanese Travel Map"

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

    client.app.dependency_overrides.clear()


def test_generate_map_endpoint_surfaces_provider_failure(client: TestClient) -> None:
    goal_id = _create_goal(client)

    provider = FakeLLMProvider(["{"])
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    response = client.post(f"/goals/{goal_id}/maps/generate")

    assert response.status_code == 422
    assert "Could not produce a valid graph bundle" in response.json()["detail"]

    client.app.dependency_overrides.clear()
