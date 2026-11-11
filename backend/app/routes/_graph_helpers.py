"""Helpers compartilhados entre rotas de grafo/projeto (P1.13) e checagens de ownership (P1.2).

Semântica de acesso (IDOR-safe — 404 para recurso de terceiro, sem vazar existência):

- Projeto visível para o usuário quando: dono (owner_id), público (is_public),
  ou com entrada ProjectAccess (email) de role read/full.
- Projeto editável quando: dono, role senior, ou ProjectAccess de role full.
- Grafo visível quando: dono (owner_id), entrada GraphAccess (team = e-mail ou
  username do usuário) de role read/write/admin, ou o projeto-pai é visível.
- Grafo editável quando: dono, role senior, GraphAccess de role write/admin,
  ou o projeto-pai é editável.

As tabelas de ACL reais (P2.2.3): ProjectAccess usa (email, role read|full);
GraphAccess usa (team, role read|write|admin) — "team" carrega o granteado
(email/username) aqui.
"""

from __future__ import annotations

import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.graph import Graph, GraphAccess, Project, ProjectAccess
from app.models.user import User
from app.schemas.graph import GraphOut, ProjectNfr


def graph_etag(graph: Graph) -> str:
    """Weak ETag from updated_at — used for optimistic concurrency (If-Match)."""
    ts = graph.updated_at.isoformat() if graph.updated_at else "0"
    return f'W/"{graph.id}:{ts}"'


def _apply_etag(response, graph: Graph) -> None:
    response.headers["ETag"] = graph_etag(graph)
    response.headers["Cache-Control"] = "no-cache"


def _parse_json_list(raw: str) -> list:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Grafo corrompido no banco") from exc
    return data if isinstance(data, list) else []


def _parse_json_obj(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _nfr_out(graph: Graph) -> ProjectNfr | None:
    raw = getattr(graph, "nfr_json", None) or "{}"
    data = _parse_json_obj(raw)
    if not data:
        return ProjectNfr()
    try:
        return ProjectNfr.model_validate(data)
    except Exception:  # noqa: BLE001 — fallback to defaults on malformed NFR data
        return ProjectNfr()


def to_out(graph: Graph) -> GraphOut:
    return GraphOut(
        id=graph.id,
        owner_id=getattr(graph, "owner_id", None),
        name=graph.name,
        context=getattr(graph, "context_text", None) or "",
        nfr=_nfr_out(graph),
        nodes=_parse_json_list(graph.nodes_json),
        edges=_parse_json_list(graph.edges_json),
        analysis=_parse_json_obj(graph.analysis_json),
        review_status=graph.review_status,  # type: ignore[arg-type]
        review_comment=graph.review_comment,
        reviewer_role=graph.reviewer_role,
        project_id=getattr(graph, "project_id", None),
        owner_team=getattr(graph, "owner_team", None),
        diagram_kind=getattr(graph, "diagram_kind", None),
        parent_graph_id=getattr(graph, "parent_graph_id", None),
        c4_parent_node_id=getattr(graph, "c4_parent_node_id", None),
        excalidraw_elements=_parse_json_list(getattr(graph, "excalidraw_elements_json", "[]")),
        created_at=graph.created_at,
        updated_at=graph.updated_at,
    )


def _grantee_tokens(user: User) -> set[str]:
    """Identidades com as quais o usuário pode ter sido granteado em ACLs de squad."""
    tokens = {user.email.lower()}
    if user.username:
        tokens.add(user.username.lower())
    return tokens


def can_view_project(db: Session, user: User, project: Project) -> bool:
    if project.owner_id == user.id:
        return True
    if project.is_public:
        return True
    row = db.execute(
        select(ProjectAccess.id).where(
            ProjectAccess.project_id == project.id,
            ProjectAccess.email == user.email,
            ProjectAccess.role.in_(("read", "full")),
        ).limit(1)
    ).first()
    return row is not None


def can_edit_project(db: Session, user: User, project: Project) -> bool:
    if project.owner_id == user.id:
        return True
    if getattr(user, "role", None) == "senior":
        return True
    row = db.execute(
        select(ProjectAccess.id).where(
            ProjectAccess.project_id == project.id,
            ProjectAccess.email == user.email,
            ProjectAccess.role == "full",
        ).limit(1)
    ).first()
    return row is not None


def can_view_graph(db: Session, user: User, graph: Graph) -> bool:
    if graph.owner_id == user.id:
        return True
    tokens = _grantee_tokens(user)
    row = db.execute(
        select(GraphAccess.id).where(
            GraphAccess.graph_id == graph.id,
            GraphAccess.team.in_(list(tokens)),
            GraphAccess.role.in_(("read", "write", "admin")),
        ).limit(1)
    ).first()
    if row:
        return True
    if graph.project_id:
        project = db.get(Project, graph.project_id)
        if project is not None:
            return can_view_project(db, user, project)
    return False


def can_edit_graph(db: Session, user: User, graph: Graph) -> bool:
    if graph.owner_id == user.id:
        return True
    if getattr(user, "role", None) == "senior":
        return True
    tokens = _grantee_tokens(user)
    row = db.execute(
        select(GraphAccess.id).where(
            GraphAccess.graph_id == graph.id,
            GraphAccess.team.in_(list(tokens)),
            GraphAccess.role.in_(("write", "admin")),
        ).limit(1)
    ).first()
    if row:
        return True
    if graph.project_id:
        project = db.get(Project, graph.project_id)
        if project is not None:
            return can_edit_project(db, user, project)
    return False


def get_project_or_404(db: Session, user: User, project_id: str, *, write: bool = False) -> Project:
    """Retorna o projeto se o usuário tiver acesso (leitura ou escrita); senão 404."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if write:
        if not can_edit_project(db, user, project):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return project
    if not can_view_project(db, user, project):
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


def get_graph_or_404(db: Session, user: User, graph_id: str, *, write: bool = False) -> Graph:
    """Retorna o grafo se o usuário tiver acesso (leitura ou escrita); senão 404."""
    graph = db.get(Graph, graph_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    if write:
        if not can_edit_graph(db, user, graph):
            raise HTTPException(status_code=404, detail="Grafo não encontrado")
        return graph
    if not can_view_graph(db, user, graph):
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    return graph


def viewable_project_ids(db: Session, user: User) -> set[str]:
    """IDs de projetos visíveis para o usuário (dono + ACL por e-mail + públicos)."""
    ids = {row[0] for row in db.execute(
        select(Project.id).where(Project.owner_id == user.id)
    )}
    ids |= {row[0] for row in db.execute(
        select(ProjectAccess.project_id).where(
            ProjectAccess.email == user.email,
            ProjectAccess.role.in_(("read", "full")),
        )
    )}
    ids |= {row[0] for row in db.execute(
        select(Project.id).where(Project.is_public.is_(True))
    )}
    return ids


def viewable_graph_ids(db: Session, user: User) -> set[str]:
    """IDs de grafos visíveis para o usuário (dono + GraphAccess + projeto visível)."""
    ids = {row[0] for row in db.execute(
        select(Graph.id).where(Graph.owner_id == user.id)
    )}
    tokens = _grantee_tokens(user)
    ids |= {row[0] for row in db.execute(
        select(GraphAccess.graph_id).where(
            GraphAccess.team.in_(list(tokens)),
            GraphAccess.role.in_(("read", "write", "admin")),
        )
    )}
    proj_ids = viewable_project_ids(db, user)
    if proj_ids:
        ids |= {row[0] for row in db.execute(
            select(Graph.id).where(Graph.project_id.in_(list(proj_ids)))
        )}
    return ids
