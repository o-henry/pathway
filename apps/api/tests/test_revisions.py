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
    monkeypatch.setenv("LIFEMAP_SQLITE_URL", f"sqlite:///{tmp_path / 'revision-test.db'}")
    monkeypatch.setenv("LIFEMAP_DATA_DIR", str(tmp_path / 'data'))
    monkeypatch.setenv("LIFEMAP_LANCEDB_URI", str(tmp_path / 'lancedb'))
    get_settings.cache_clear()
    build_engine.cache_clear()

    app = create_app()
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    build_engine.cache_clear()
    get_settings.cache_clear()


def _put_profile(client: TestClient) -> None:
    response = client.put(
        '/profiles/default',
        json={
            'display_name': 'Henry',
            'weekly_free_hours': 5,
            'monthly_budget_amount': 100000,
            'monthly_budget_currency': 'KRW',
            'energy_level': 'medium',
            'preference_tags': ['solo', 'easily_bored'],
            'constraints': {'timebox': 'evenings'},
        },
    )
    assert response.status_code == 200


def _create_goal(client: TestClient) -> str:
    response = client.post(
        '/goals',
        json={
            'profile_id': 'default',
            'title': 'Learn Japanese for travel',
            'description': 'Need a focused route',
            'category': 'language',
            'success_criteria': 'Handle food orders and directions in Japan',
            'status': 'active',
        },
    )
    assert response.status_code == 201
    return response.json()['id']


def _create_source(client: TestClient) -> None:
    response = client.post(
        '/sources/manual',
        json={
            'title': 'Speaking note',
            'content_text': (
                '여행 회화 목표라면 주말 speaking drill을 빨리 붙이는 편이 유지에 좋다. '
                '문법만 길게 밀면 지루함이 커진다.'
            ),
            'source_type': 'manual_note',
        },
    )
    assert response.status_code == 201


def _create_map(client: TestClient, goal_id: str) -> str:
    bundle = build_valid_graph_bundle()
    bundle['map']['goal_id'] = goal_id
    response = client.post(
        '/maps',
        json={
            'goal_id': goal_id,
            'title': 'Initial graph snapshot',
            'graph_bundle': bundle,
        },
    )
    assert response.status_code == 201
    return response.json()['id']


def _create_checkin(client: TestClient, goal_id: str, map_id: str) -> str:
    response = client.post(
        f'/goals/{goal_id}/checkins',
        json={
            'map_id': map_id,
            'actual_time_spent': 3,
            'actual_money_spent': 0,
            'mood': 'mixed',
            'progress_summary': '문법에서 흥미가 떨어졌지만 짧은 말하기는 괜찮았다.',
            'blockers': '평일 저녁 집중력이 낮다.',
            'next_adjustment': '주말 speaking drill을 추가하고 평일은 짧게 간다.',
        },
    )
    assert response.status_code == 201
    return response.json()['id']


def _build_revised_bundle(goal_id: str) -> dict:
    bundle = build_valid_graph_bundle()
    bundle['map']['goal_id'] = goal_id
    bundle['map']['title'] = 'Revised Japanese Travel Map'
    bundle['nodes'][1]['summary'] = 'Keep self-study, but add a short weekend speaking drill.'
    bundle['nodes'][1]['status'] = 'at_risk'
    bundle['nodes'][1]['data']['fit_reason'] = (
        'Budget still fits, but boredom risk needs an output loop.'
    )
    bundle['nodes'][1]['revision_meta'] = {
        'change_note': (
            'Speaking drill added because the latest check-in reported boredom '
            'in grammar-heavy sessions.'
        )
    }
    bundle['nodes'][1]['evidence_refs'] = ['ev_rag_001']
    bundle['evidence'] = [
        {
            'id': 'ev_rag_001',
            'source_id': 'src_placeholder',
            'title': 'Placeholder',
            'quote_or_summary': 'Placeholder',
            'url': None,
            'reliability': 'placeholder',
        }
    ]
    return bundle


def test_revision_proposal_can_be_accepted_into_new_snapshot(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)
    _create_source(client)
    map_id = _create_map(client, goal_id)
    checkin_id = _create_checkin(client, goal_id, map_id)

    provider = FakeLLMProvider([json.dumps(_build_revised_bundle(goal_id), ensure_ascii=False)])
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    proposal_response = client.post(
        f'/maps/{map_id}/revision-proposals',
        json={'checkin_id': checkin_id},
    )

    assert proposal_response.status_code == 201
    proposal = proposal_response.json()
    assert proposal['status'] == 'pending'
    assert proposal['diff']['node_changes'][0]['change_type'] in {'updated', 'status_changed'}

    accept_response = client.post(
        f"/revision-proposals/{proposal['id']}/accept",
        json={'note': 'accept test'},
    )
    assert accept_response.status_code == 200
    accepted_map = accept_response.json()
    assert accepted_map['goal_id'] == goal_id
    assert accepted_map['id'] != map_id
    assert accepted_map['graph_bundle']['nodes'][1]['status'] == 'at_risk'

    proposal_fetch = client.get(f"/revision-proposals/{proposal['id']}")
    assert proposal_fetch.status_code == 200
    assert proposal_fetch.json()['status'] == 'accepted'
    assert proposal_fetch.json()['accepted_map_id'] == accepted_map['id']

    client.app.dependency_overrides.clear()


def test_revision_proposal_can_be_rejected(client: TestClient) -> None:
    _put_profile(client)
    goal_id = _create_goal(client)
    _create_source(client)
    map_id = _create_map(client, goal_id)
    checkin_id = _create_checkin(client, goal_id, map_id)

    provider = FakeLLMProvider([json.dumps(_build_revised_bundle(goal_id), ensure_ascii=False)])
    client.app.dependency_overrides[get_llm_provider] = lambda: provider

    proposal_response = client.post(
        f'/maps/{map_id}/revision-proposals',
        json={'checkin_id': checkin_id},
    )
    proposal_id = proposal_response.json()['id']

    reject_response = client.post(
        f'/revision-proposals/{proposal_id}/reject',
        json={'note': 'reject test'},
    )

    assert reject_response.status_code == 200
    assert reject_response.json()['status'] == 'rejected'

    client.app.dependency_overrides.clear()
