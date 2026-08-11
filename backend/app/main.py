import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.models import (  # noqa: F401 — register metadata
    AiSettings,
    Graph,
    GraphVersion,
    Session,
    User,
)
from app.routes.auth import router as auth_router
from app.routes.graphs import router as graphs_router
from app.routes.health import router as health_router
from app.routes.profile import router as profile_router
from app.routes.settings import router as settings_router
from app.routes.simulations import router as simulations_router
from app.routes.users import router as users_router
from app.seed import seed_default_users

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("archia")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()
    seed_default_users()
    logger.info("archia_started cors=%s db=%s", settings.origin_list, settings.database_url)
    yield


def _ensure_sqlite_columns() -> None:
    """SQLite create_all não altera tabelas existentes — adiciona colunas novas se faltar."""
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "graphs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("graphs")}
    with engine.begin() as conn:
        if "context_text" not in cols:
            conn.execute(text("ALTER TABLE graphs ADD COLUMN context_text TEXT NOT NULL DEFAULT ''"))
        if "nfr_json" not in cols:
            conn.execute(text("ALTER TABLE graphs ADD COLUMN nfr_json TEXT NOT NULL DEFAULT '{}'"))


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(health_router)
app.include_router(graphs_router)
app.include_router(settings_router)
app.include_router(simulations_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(users_router)
