from fastapi.testclient import TestClient

from lifemap_api.config import get_settings
from lifemap_api.main import app
from lifemap_api.main import create_app


def test_health_endpoint_returns_ok_status() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_local_api_token_protects_non_health_routes(monkeypatch) -> None:
    monkeypatch.setenv("LIFEMAP_LOCAL_API_TOKEN", "test-local-token")
    get_settings.cache_clear()
    client = TestClient(create_app())

    blocked = client.get("/goals")
    allowed = client.get("/goals", headers={"Authorization": "Bearer test-local-token"})

    assert blocked.status_code == 401
    assert allowed.status_code == 200
    get_settings.cache_clear()
