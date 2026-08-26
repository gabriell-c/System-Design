import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("CORS_ORIGINS", "http://testserver")
os.environ.setdefault("OMNIROUTE_TIMEOUT_S", "1")
# ≥ 32 bytes — evita InsecureKeyLengthWarning do PyJWT
os.environ.setdefault("ARCHIA_JWT_SECRET", "archia-test-secret-key-32b-minimum!!")

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
from app.models import AiSettings, Session, User  # noqa: F401
from app.rate_limit import _buckets


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    """Reset in-memory rate limiter between tests."""
    _buckets.clear()
    yield
    _buckets.clear()


@pytest.fixture()
def client() -> TestClient:
    """Authenticated TestClient (SENIOR cookie). Clear cookies for anonymous cases."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        login = test_client.post(
            "/api/v1/auth/login",
            json={"username": "SENIOR", "password": "CHANGEPASSWORD"},
        )
        assert login.status_code == 200, login.text
        yield test_client


@pytest.fixture()
def anonymous_client() -> TestClient:
    """Unauthenticated client for 401 / public-route tests."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    """Bearer header from current session (login already done in client)."""
    # Re-login to obtain access_token in body
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "SENIOR", "password": "CHANGEPASSWORD"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture()
def no_omniroute(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _none(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.agents.runner.complete_json", _none)
