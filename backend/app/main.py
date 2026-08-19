import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.middleware.audit import AuditMiddleware
from app.models import (  # noqa: F401 — register metadata
    AiSettings,
    AuditEntry,
    Comment,
    Graph,
    GraphVersion,
    Project,
    Session,
    SimulationScenario,
    User,
)
from app.routes.auth import router as auth_router
from app.routes.acl import router as acl_router
from app.routes.audit import router as audit_router
from app.routes.boundary import router as boundary_router
from app.routes.comments import router as comments_router
from app.routes.embed import router as embed_router
from app.routes.graphs import router as graphs_router
from app.routes.health import router as health_router
from app.routes.p1 import router as p1_router
from app.routes.private_catalog import router as private_catalog_router
from app.routes.profile import router as profile_router
from app.routes.projects import router as projects_router
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
    existing = set(inspector.get_table_names())
    with engine.begin() as conn:
        if "projects" not in existing:
            conn.execute(text("""
                CREATE TABLE projects (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    context TEXT NOT NULL DEFAULT '',
                    nfr_json TEXT NOT NULL DEFAULT '{}',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
        if "graphs" in existing and "project_id" not in {
            c["name"] for c in inspector.get_columns("graphs")
        }:
            conn.execute(text("ALTER TABLE graphs ADD COLUMN project_id VARCHAR(36) NULL"))
        if "graphs" in existing and "context_text" not in {
            c["name"] for c in inspector.get_columns("graphs")
        }:
            conn.execute(text("ALTER TABLE graphs ADD COLUMN context_text TEXT NOT NULL DEFAULT ''"))
        if "graphs" in existing and "nfr_json" not in {
            c["name"] for c in inspector.get_columns("graphs")
        }:
            conn.execute(text("ALTER TABLE graphs ADD COLUMN nfr_json TEXT NOT NULL DEFAULT '{}'"))
        if "comments" not in existing:
            conn.execute(text("""
                CREATE TABLE comments (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    graph_id VARCHAR(36) NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
                    node_id VARCHAR(36) NULL,
                    text TEXT NOT NULL,
                    author VARCHAR(200) NOT NULL DEFAULT 'anonymous',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
        if "graphs" in existing and "owner_team" not in {
            c["name"] for c in inspector.get_columns("graphs")
        }:
            conn.execute(text("ALTER TABLE graphs ADD COLUMN owner_team VARCHAR(80) NULL"))
        if "comments" in existing:
            cols = {c["name"] for c in inspector.get_columns("comments")}
            for col, ddl in [
                ("position_x", "ALTER TABLE comments ADD COLUMN position_x FLOAT NULL"),
                ("position_y", "ALTER TABLE comments ADD COLUMN position_y FLOAT NULL"),
                ("resolved", "ALTER TABLE comments ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT 0"),
                ("assignee", "ALTER TABLE comments ADD COLUMN assignee VARCHAR(200) NULL"),
                ("mentions_json", "ALTER TABLE comments ADD COLUMN mentions_json TEXT NOT NULL DEFAULT '[]'"),
                ("thread_parent_id", "ALTER TABLE comments ADD COLUMN thread_parent_id VARCHAR(36) NULL"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))
        if "simulation_scenarios" not in existing:
            conn.execute(text("""
                CREATE TABLE simulation_scenarios (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    graph_id VARCHAR(36) NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
                    name VARCHAR(200) NOT NULL,
                    payload_json TEXT NOT NULL DEFAULT '{}',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
        if "graph_access" not in existing:
            conn.execute(text("""
                CREATE TABLE graph_access (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    graph_id VARCHAR(36) NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
                    team VARCHAR(80) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'read',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(graph_id, team)
                )
            """))
        if "audit_entries" not in existing:
            conn.execute(text("""
                CREATE TABLE audit_entries (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    graph_id VARCHAR(36) NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
                    user_email VARCHAR(200) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id VARCHAR(36) NULL,
                    previous_state TEXT NOT NULL DEFAULT '{}',
                    new_state TEXT NOT NULL DEFAULT '{}',
                    ip_address VARCHAR(45) NULL,
                    user_agent VARCHAR(500) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
        if "graph_boundary_contracts" not in existing:
            conn.execute(text("""
                CREATE TABLE graph_boundary_contracts (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    graph_id VARCHAR(36) NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
                    source_zone VARCHAR(100) NOT NULL,
                    target_zone VARCHAR(100) NOT NULL,
                    protocol VARCHAR(50) NOT NULL DEFAULT 'async',
                    description TEXT NOT NULL DEFAULT '',
                    sla_ms INTEGER NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type", "Authorization"],
    max_age=600,
)
app.include_router(health_router)
app.include_router(acl_router)
app.include_router(boundary_router)
app.include_router(graphs_router)
app.include_router(comments_router)
app.include_router(audit_router)
app.include_router(p1_router)
app.include_router(embed_router)
app.include_router(private_catalog_router)
app.include_router(projects_router)
app.include_router(settings_router)
app.include_router(simulations_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(users_router)
