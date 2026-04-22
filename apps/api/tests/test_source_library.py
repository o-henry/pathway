from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from lifemap_api.api.dependencies import get_embedding_provider
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.main import create_app

from .fake_embeddings import FakeEmbeddingProvider


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("LIFEMAP_SQLITE_URL", f"sqlite:///{tmp_path / 'sources-test.db'}")
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


def test_manual_source_ingestion_and_search(client: TestClient) -> None:
    response = client.post(
        "/sources/manual",
        json={
            "title": "일본어 회화 메모",
            "content_text": (
                "일본어 여행 회화를 위해 주 5시간 루틴을 만든다.\n\n"
                "Anki와 짧은 speaking drill을 같이 돌리면 지루함이 줄어든다."
            ),
            "source_type": "manual_note",
            "metadata": {"tags": ["japanese", "language-learning"]},
        },
    )

    assert response.status_code == 201
    source_id = response.json()["id"]

    search_response = client.get(
        "/sources/search",
        params={"query": "일본어 speaking 루틴", "limit": 3},
    )
    assert search_response.status_code == 200
    hits = search_response.json()
    assert hits
    assert hits[0]["source_id"] == source_id
    assert hits[0]["title"] == "일본어 회화 메모"
    assert hits[0]["similarity_score"] > 0


def test_duplicate_content_hash_returns_existing_source(client: TestClient) -> None:
    payload = {
        "title": "중복 메모",
        "content_text": "예산이 적으면 비용보다 지속성을 먼저 설계한다.",
        "source_type": "manual_note",
    }

    first_response = client.post("/sources/manual", json=payload)
    second_response = client.post("/sources/manual", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert second_response.json()["id"] == first_response.json()["id"]

    list_response = client.get("/sources")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_blocked_url_preview_does_not_allow_fetch(client: TestClient) -> None:
    response = client.post("/sources/url-preview", json={"url": "http://127.0.0.1:8000/secret"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["policy_state"] == "blocked_by_policy"
    assert payload["fetch_allowed"] is False
    assert payload["metadata_only"] is False


def test_url_ingest_fetches_and_indexes_public_page(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("SOURCE_FETCH_ENABLED", "true")

    from lifemap_api.application import source_pipeline

    class FakeResponse:
        def __init__(self) -> None:
            self.url = "https://example.com/story"
            self.text = (
                "<html><head><title>Example Story</title></head>"
                "<body><article><h1>Example Story</h1>"
                "<p>English conversation partners helped me practice speaking every week.</p>"
                "<p>Recording and listening improved my fluency.</p>"
                "</article></body></html>"
            )
            self.headers = {"content-type": "text/html; charset=utf-8"}

        def raise_for_status(self) -> None:
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            del args, kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            del exc_type, exc, tb
            return None

        def get(self, url: str) -> FakeResponse:
            assert url == "https://example.com/story"
            return FakeResponse()

    monkeypatch.setattr(source_pipeline, "check_robots_permission", lambda url: (True, "ok"))
    monkeypatch.setattr(source_pipeline.httpx, "Client", FakeClient)
    get_settings.cache_clear()

    response = client.post(
        "/sources/url/ingest",
        json={
            "url": "https://example.com/story",
            "metadata": {"layer": "personal_story", "publisher": "Example"},
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["source_type"] == "public_url_allowed"
    assert payload["metadata"]["collector_used"] == "trafilatura"

    search_response = client.get(
        "/sources/search",
        params={"query": "conversation partners fluency", "limit": 3},
    )
    assert search_response.status_code == 200
    hits = search_response.json()
    assert hits
    assert hits[0]["source_id"] == payload["id"]
