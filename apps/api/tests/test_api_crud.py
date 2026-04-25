from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_embedding_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.main import create_app

from .fake_embeddings import FakeEmbeddingProvider
from .graph_bundle_fixture import clone_bundle


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("LIFEMAP_SQLITE_URL", f"sqlite:///{tmp_path / 'api-test.db'}")
    monkeypatch.setenv("LIFEMAP_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("LIFEMAP_LANCEDB_URI", str(tmp_path / "lancedb"))
    get_settings.cache_clear()
    build_engine.cache_clear()

    app = create_app()
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    build_engine.cache_clear()
    get_settings.cache_clear()


def test_full_phase_one_crud_flow(client: TestClient) -> None:
    profile_response = client.put(
        "/profiles/default",
        json={
            "display_name": "Henry",
            "weekly_free_hours": 6,
            "preference_tags": ["solo"],
            "constraints": {"budget": "tight"},
        },
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["display_name"] == "Henry"

    goal_response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": "Learn Japanese",
            "description": "Conversation route",
            "category": "language",
            "success_criteria": "Navigate a trip confidently",
            "status": "active",
        },
    )
    assert goal_response.status_code == 201
    goal_id = goal_response.json()["id"]

    analysis_response = client.post(f"/goals/{goal_id}/analysis")
    assert analysis_response.status_code == 200
    assert len(analysis_response.json()["resource_dimensions"]) >= 1

    current_state_response = client.put(
        f"/goals/{goal_id}/current-state",
        json={
            "interview_answers": {"time_budget": "6", "money_budget": "50000"},
            "resource_values": {"time_budget": 6, "money_budget": 50000},
            "active_constraints": ["tight budget", "weekday fatigue"],
            "state_summary": "Current state is constrained but viable.",
            "derived_from_update_ids": [],
        },
    )
    assert current_state_response.status_code == 200

    map_response = client.post(
        "/maps",
        json={
            "goal_id": goal_id,
            "title": "Initial graph snapshot",
            "graph_bundle": clone_bundle(),
        },
    )
    assert map_response.status_code == 201
    map_id = map_response.json()["id"]

    source_response = client.post(
        "/sources/manual",
        json={
            "title": "Study note",
            "content_text": "Speaking practice should start by week 6.",
            "source_type": "manual_note",
        },
    )
    assert source_response.status_code == 201

    generated_pathway_response = client.post(f"/goals/{goal_id}/pathways/generate")
    assert generated_pathway_response.status_code in {201, 503, 502, 422}

    checkin_response = client.post(
        f"/goals/{goal_id}/checkins",
        json={
            "map_id": map_id,
            "progress_summary": "Finished basic greetings.",
            "blockers": "Motivation dips on weekdays.",
            "next_adjustment": "Add a short weekend speaking session.",
        },
    )
    assert checkin_response.status_code == 201

    state_update_response = client.post(
        f"/goals/{goal_id}/state-updates",
        json={
            "pathway_id": map_id,
            "progress_summary": "Finished basic greetings.",
            "blockers": "Motivation dips on weekdays.",
            "next_adjustment": "Add a short weekend speaking session.",
            "resource_deltas": {"energy_pattern": "weekday dip"},
            "learned_items": ["basic greetings"],
        },
    )
    assert state_update_response.status_code == 201

    route_selection_response = client.put(
        f"/pathways/{map_id}/route-selection",
        json={
            "selected_node_id": clone_bundle()["nodes"][0]["id"],
            "rationale": "This is the current trunk.",
        },
    )
    assert route_selection_response.status_code == 200

    assert client.get("/goals").status_code == 200
    assert client.get(f"/goals/{goal_id}").status_code == 200
    assert client.get(f"/maps/{map_id}").status_code == 200
    assert client.get(f"/pathways/{map_id}").status_code == 200
    assert client.get("/sources").status_code == 200
    assert client.get(f"/goals/{goal_id}/checkins").status_code == 200
    assert client.get(f"/goals/{goal_id}/state-updates").status_code == 200

    patch_response = client.patch(
        f"/goals/{goal_id}",
        json={"status": "paused", "title": "Learn Japanese Slowly"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "paused"

    delete_response = client.delete(f"/goals/{goal_id}")
    assert delete_response.status_code == 204
    assert client.get(f"/goals/{goal_id}").status_code == 404
    assert client.get(f"/maps/{map_id}").status_code == 404
    assert client.get(f"/pathways/{map_id}").status_code == 404
    assert client.get(f"/goals/{goal_id}/maps").status_code == 404
    assert client.get(f"/goals/{goal_id}/checkins").status_code == 404
    assert client.get(f"/goals/{goal_id}/state-updates").status_code == 404


def test_invalid_graph_bundle_is_rejected_at_api_boundary(client: TestClient) -> None:
    goal_response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": "Learn Japanese",
            "description": "Conversation route",
            "category": "language",
            "success_criteria": "Navigate a trip confidently",
            "status": "active",
        },
    )
    goal_id = goal_response.json()["id"]

    invalid_bundle = clone_bundle()
    invalid_bundle["edges"][0]["target"] = "missing_node"

    response = client.post(
        "/maps",
        json={
            "goal_id": goal_id,
            "title": "Broken graph snapshot",
            "graph_bundle": invalid_bundle,
        },
    )

    assert response.status_code == 422
    assert "missing target node" in str(response.json())


def test_map_can_be_exported_as_json_and_markdown_and_reimported(client: TestClient) -> None:
    client.put(
        "/profiles/default",
        json={
            "display_name": "Henry",
            "weekly_free_hours": 5,
            "monthly_budget_amount": 100000,
            "monthly_budget_currency": "KRW",
            "preference_tags": ["solo", "reflective"],
        },
    )

    goal_response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": "Learn Japanese",
            "description": "Conversation route",
            "category": "language",
            "success_criteria": "Navigate a trip confidently",
            "status": "active",
        },
    )
    goal_id = goal_response.json()["id"]

    bundle = clone_bundle()
    bundle["map"]["goal_id"] = goal_id
    bundle["map"]["summary"] = "Original export fixture."

    map_response = client.post(
        "/maps",
        json={
            "goal_id": goal_id,
            "title": "Exportable graph snapshot",
            "graph_bundle": bundle,
        },
    )
    assert map_response.status_code == 201
    map_id = map_response.json()["id"]

    json_export_response = client.get(f"/maps/{map_id}/export/json")
    assert json_export_response.status_code == 200
    exported_payload = json_export_response.json()
    assert exported_payload["goal"]["id"] == goal_id
    assert exported_payload["map"]["id"] == map_id
    assert exported_payload["profile"]["id"] == "default"

    markdown_export_response = client.get(f"/maps/{map_id}/export/markdown")
    assert markdown_export_response.status_code == 200
    assert markdown_export_response.headers["content-type"].startswith("text/markdown")
    markdown = markdown_export_response.text
    assert "# Exportable graph snapshot" in markdown
    assert "## Nodes" in markdown
    assert "## Evidence" in markdown

    imported_response = client.post("/maps/import", json=exported_payload)
    assert imported_response.status_code == 201
    imported_map = imported_response.json()
    assert imported_map["id"] != map_id
    assert imported_map["goal_id"] == goal_id
    assert imported_map["graph_bundle"]["map"]["goal_id"] == goal_id
    assert imported_map["graph_bundle"]["nodes"][0]["label"] == bundle["nodes"][0]["label"]


def test_goal_maps_can_be_listed(client: TestClient) -> None:
    client.put(
        "/profiles/default",
        json={
            "display_name": "Henry",
            "weekly_free_hours": 5,
            "monthly_budget_amount": 100000,
            "monthly_budget_currency": "KRW",
        },
    )

    goal_response = client.post(
        "/goals",
        json={
            "profile_id": "default",
            "title": "Learn Japanese",
            "description": "Conversation route",
            "category": "language",
            "success_criteria": "Navigate a trip confidently",
            "status": "active",
        },
    )
    goal_id = goal_response.json()["id"]

    bundle = clone_bundle()
    bundle["map"]["goal_id"] = goal_id

    first_map = client.post(
        "/maps",
        json={
            "goal_id": goal_id,
            "title": "Snapshot one",
            "graph_bundle": bundle,
        },
    ).json()

    second_map = client.post(
        "/maps",
        json={
            "goal_id": goal_id,
            "title": "Snapshot two",
            "graph_bundle": bundle,
        },
    ).json()

    response = client.get(f"/goals/{goal_id}/maps")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["id"] == second_map["id"]
    assert payload[1]["id"] == first_map["id"]
