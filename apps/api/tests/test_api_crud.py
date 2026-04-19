from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.main import create_app

from .graph_bundle_fixture import clone_bundle


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("LIFEMAP_SQLITE_URL", f"sqlite:///{tmp_path / 'api-test.db'}")
    monkeypatch.setenv("LIFEMAP_DATA_DIR", str(tmp_path / "data"))
    get_settings.cache_clear()
    build_engine.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

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

    assert client.get("/goals").status_code == 200
    assert client.get(f"/goals/{goal_id}").status_code == 200
    assert client.get(f"/maps/{map_id}").status_code == 200
    assert client.get("/sources").status_code == 200
    assert client.get(f"/goals/{goal_id}/checkins").status_code == 200

    patch_response = client.patch(
        f"/goals/{goal_id}",
        json={"status": "paused", "title": "Learn Japanese Slowly"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "paused"

    delete_response = client.delete(f"/goals/{goal_id}")
    assert delete_response.status_code == 204


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
