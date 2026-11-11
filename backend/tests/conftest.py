import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("CORS_ORIGINS", "http://testserver")
os.environ.setdefault("OMNIROUTE_TIMEOUT_S", "1")
# ≥ 32 bytes — evita InsecureKeyLengthWarning do PyJWT
os.environ.setdefault("ARCHIA_JWT_SECRET", "archia-test-secret-key-32b-minimum!!")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

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


@pytest.fixture(autouse=True)
def _clear_ai_usage():
    """Orçamento diário durável (item 30) vive em SQLite — limpa entre testes."""
    _delete_ai_usage_rows()
    yield
    _delete_ai_usage_rows()


def _delete_ai_usage_rows() -> None:
    try:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM ai_usage"))
    except OperationalError:
        # Tabela inexistente (antes do primeiro lifespan/create_all) — nada a limpar.
        pass


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
    from app.services.omniroute import CompleteResult

    async def _none(*_args, **_kwargs):
        return CompleteResult(data=None, usage=None, attempts=0, ok=False)

    monkeypatch.setattr("app.agents.runner.complete_json", _none)
