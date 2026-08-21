import threading
from collections.abc import Generator
from contextlib import contextmanager, nullcontext
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_dir(url: str) -> None:
    if not url.startswith("sqlite:///"):
        return
    raw = url.replace("sqlite:///", "", 1)
    if raw in {":memory:", ""} or raw.startswith(":memory:"):
        return
    path = Path(raw)
    if path.parent and str(path.parent) not in {".", ""}:
        path.parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_dir(settings.database_url)

_IS_SQLITE = settings.database_url.startswith("sqlite")
# Serializa writers SQLite (StaticPool / :memory: não tolera flush paralelo).
_sqlite_write_lock = threading.RLock()

if _IS_SQLITE and (
    ":memory:" in settings.database_url or settings.database_url in {"sqlite://", "sqlite:///:memory:"}
):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    connect_args = {"check_same_thread": False} if _IS_SQLITE else {}
    engine_kwargs: dict = {"connect_args": connect_args}
    if not _IS_SQLITE:
        # Postgres / managed DB — modest pool suitable for API pods
        engine_kwargs.update(pool_pre_ping=True, pool_size=5, max_overflow=10)
    engine = create_engine(settings.database_url, **engine_kwargs)

if _IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _sqlite_on_connect(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        try:
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA journal_mode=WAL")
        except Exception:  # noqa: BLE001
            pass
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@contextmanager
def sqlite_write_guard():
    """Lock só em volta do flush/commit — não atravessa o TestClient (evita deadlock)."""
    if not _IS_SQLITE:
        with nullcontext():
            yield
        return
    with _sqlite_write_lock:
        yield


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
