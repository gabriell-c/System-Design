import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("CORS_ORIGINS", "http://testserver")
os.environ.setdefault("OMNIROUTE_TIMEOUT_S", "1")

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
from app.models import AiSettings, User, Session  # noqa: F401
from app.rate_limit import _buckets


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    """Reset in-memory rate limiter between tests."""
    _buckets.clear()
    yield
    _buckets.clear()


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def no_omniroute(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _none(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.agents.runner.complete_json", _none)
