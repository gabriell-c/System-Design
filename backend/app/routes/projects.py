"""Projects API — CRUD, archive, pin, share URL, ACL e subsystems."""

from __future__ import annotations

import json
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db, sqlite_write_guard
from app.models.graph import Graph, Project, ProjectAccess, new_uuid
from app.routes.graphs import to_out
from app.schemas.graph import GraphOut, GraphPayload, ProjectNfr
from app.schemas.project import (
    ProjectAccessEntry,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    ShareUrlOut,
)
from app.services.subsystems import get_subsystem, prefix_graph
from app.services.subsystems import list_subsystems as catalog_subsystems

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

DIAGRAM_KIND_META: dict[str, str] = {
    "context": "Context Diagram",
    "application": "Application Diagram",
    "data": "Data Diagram",
    "runtime": "Runtime Diagram",
    "security": "Security Diagram",
    "dr": "DR Diagram",
    "sequence": "Sequence Diagram",
}

DEFAULT_DIAGRAM_KINDS = list(DIAGRAM_KIND_META.keys())


class SubsystemImportIn(BaseModel):
    subsystem_id: str = Field(min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=200)
    owner_team: str | None = Field(default=None, max_length=80)
    merge_into_graph_id: str | None = Field(default=None, max_length=36)
    offset_x: float = 0
    offset_y: float = 0


def _access_list(project: Project) -> list[ProjectAccessEntry]:
    return [
        ProjectAccessEntry(email=e.email, role=e.role if e.role in ("read", "full") else "read")
        for e in (project.access_entries or [])
    ]


def _node_count(project: Project) -> int:
    total = 0
    for d in project.diagrams or []:
        try:
            nodes = json.loads(d.nodes_json or "[]")
            total += len(nodes) if isinstance(nodes, list) else 0
        except (json.JSONDecodeError, TypeError):
            continue
    return total


def _to_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        context=project.context or "",
        description=getattr(project, "description", None) or "",
        nfr_json=project.nfr_json or "{}",
        is_public=bool(getattr(project, "is_public", False)),
        archived=bool(getattr(project, "archived", False)),
        pinned=bool(getattr(project, "pinned", False)),
        share_token=getattr(project, "share_token", None),
        created_at=project.created_at,
        updated_at=project.updated_at,
        access_list=_access_list(project),
        diagram_count=len(project.diagrams or []),
        node_count=_node_count(project),
    )


def _replace_access(db: Session, project: Project, entries: list[ProjectAccessEntry]) -> None:
    for existing in list(project.access_entries or []):
        db.delete(existing)
    db.flush()
    for entry in entries:
        email = entry.email.strip().lower()
        if not email:
            continue
        db.add(
            ProjectAccess(
                id=new_uuid(),
                project_id=project.id,
                email=email,
                role=entry.role,
            )
        )


def _get_project(db: Session, project_id: str) -> Project:
    project = db.scalar(
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.diagrams), selectinload(Project.access_entries))
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/subsystems")
def list_subsystem_catalog():
    return catalog_subsystems()


@router.get("", response_model=list[ProjectOut])
def list_projects(
    search: str | None = Query(default=None, description="Busca por nome ou descrição"),
    sort_by: Literal["recent", "heaviest", "name"] = Query(default="recent"),
    archived: bool = Query(default=False, description="Listar arquivados"),
    pinned_first: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[ProjectOut]:
    stmt = (
        select(Project)
        .options(selectinload(Project.diagrams), selectinload(Project.access_entries))
        .where(Project.archived.is_(archived))
    )
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(or_(Project.name.ilike(q), Project.description.ilike(q)))

    projects = list(db.scalars(stmt).unique().all())

    def sort_key(p: Project):
        pin = 0 if (pinned_first and p.pinned) else 1
        if sort_by == "name":
            return (pin, (p.name or "").lower())
        if sort_by == "heaviest":
            return (pin, -_node_count(p), -(p.updated_at.timestamp() if p.updated_at else 0))
        return (pin, -(p.updated_at.timestamp() if p.updated_at else 0))

    projects.sort(key=sort_key)
    return [_to_out(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> ProjectOut:
    share_token = secrets.token_urlsafe(24) if body.is_public else None
    project = Project(
        id=new_uuid(),
        name=body.name.strip(),
        description=(body.description or "").strip(),
        context=body.context or "",
        nfr_json=body.nfr_json or "{}",
        is_public=body.is_public,
        share_token=share_token,
        archived=False,
        pinned=False,
    )
    db.add(project)
    db.flush()
    _replace_access(db, project, body.access_list)
    for kind in DEFAULT_DIAGRAM_KINDS:
        label = DIAGRAM_KIND_META[kind]
        db.add(
            Graph(
                id=new_uuid(),
                project_id=project.id,
                name=f"{body.name.strip()} — {label}",
                context_text=body.context or "",
                nfr_json=body.nfr_json or "{}",
                nodes_json="[]",
                edges_json="[]",
                diagram_kind=kind,
                review_status="draft",
            )
        )
    db.commit()
    return _to_out(_get_project(db, project.id))


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)) -> ProjectOut:
    return _to_out(_get_project(db, project_id))


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)
) -> ProjectOut:
    project = _get_project(db, project_id)
    data = body.model_dump(exclude_unset=True)
    access_list = data.pop("access_list", None)

    if "name" in data and data["name"] is not None:
        project.name = data["name"].strip()
    if "description" in data and data["description"] is not None:
        project.description = data["description"].strip()
    if "context" in data and data["context"] is not None:
        project.context = data["context"]
    if "nfr_json" in data and data["nfr_json"] is not None:
        project.nfr_json = data["nfr_json"]
    if "is_public" in data and data["is_public"] is not None:
        project.is_public = data["is_public"]
        if project.is_public and not project.share_token:
            project.share_token = secrets.token_urlsafe(24)
        if not project.is_public:
            project.share_token = None
    if "pinned" in data and data["pinned"] is not None:
        project.pinned = data["pinned"]
    if "archived" in data and data["archived"] is not None:
        project.archived = data["archived"]

    if access_list is not None:
        entries = [ProjectAccessEntry.model_validate(e) for e in access_list]
        _replace_access(db, project, entries)

    db.commit()
    return _to_out(_get_project(db, project_id))


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    project = _get_project(db, project_id)
    db.delete(project)
    db.commit()


@router.patch("/{project_id}/archive", response_model=ProjectOut)
def toggle_archive(project_id: str, db: Session = Depends(get_db)) -> ProjectOut:
    project = _get_project(db, project_id)
    project.archived = not bool(project.archived)
    db.commit()
    return _to_out(_get_project(db, project_id))


@router.patch("/{project_id}/pin", response_model=ProjectOut)
def toggle_pin(project_id: str, db: Session = Depends(get_db)) -> ProjectOut:
    project = _get_project(db, project_id)
    project.pinned = not bool(project.pinned)
    db.commit()
    return _to_out(_get_project(db, project_id))


@router.get("/{project_id}/share-url", response_model=ShareUrlOut)
def get_share_url(project_id: str, db: Session = Depends(get_db)) -> ShareUrlOut:
    project = _get_project(db, project_id)
    if not project.is_public:
        raise HTTPException(status_code=400, detail="Project is private; enable is_public first")
    if not project.share_token:
        project.share_token = secrets.token_urlsafe(24)
        db.commit()
        db.refresh(project)
    return ShareUrlOut(
        share_url=f"/share/{project.share_token}",
        share_token=project.share_token or "",
        is_public=True,
    )


@router.get("/{project_id}/diagrams", response_model=list[GraphOut])
def list_diagrams(project_id: str, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)
    return [to_out(g) for g in project.diagrams]


@router.post("/{project_id}/diagrams", response_model=GraphOut, status_code=201)
def create_diagram(project_id: str, payload: GraphPayload, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    diagram = Graph(
        id=new_uuid(),
        project_id=project_id,
        name=payload.name.strip(),
        context_text=(payload.context or "").strip(),
        nfr_json=(payload.nfr or ProjectNfr()).model_dump_json(),
        nodes_json=json.dumps(payload.nodes),
        edges_json=json.dumps(payload.edges),
        owner_team=payload.owner_team,
        diagram_kind=getattr(payload, "diagram_kind", None),
        parent_graph_id=getattr(payload, "parent_graph_id", None),
        c4_parent_node_id=getattr(payload, "c4_parent_node_id", None),
        review_status="draft",
    )
    with sqlite_write_guard():
        db.add(diagram)
        db.commit()
        db.refresh(diagram)
    return to_out(diagram)


@router.post("/{project_id}/subsystems/import", response_model=GraphOut, status_code=201)
def import_subsystem(project_id: str, payload: SubsystemImportIn, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    try:
        spec = get_subsystem(payload.subsystem_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Subsystem not found") from None

    owner = payload.owner_team or spec.get("owner_team")
    name = payload.name or spec["name"]

    if payload.merge_into_graph_id:
        graph = db.get(Graph, payload.merge_into_graph_id)
        if not graph or graph.project_id != project_id:
            raise HTTPException(status_code=404, detail="Grafo alvo não encontrado neste projeto")
        prefix = f"{payload.subsystem_id}-{new_uuid()[:8]}-"
        extra_nodes, extra_edges = prefix_graph(spec, prefix, payload.offset_x, payload.offset_y)
        nodes = json.loads(graph.nodes_json or "[]")
        edges = json.loads(graph.edges_json or "[]")
        if not isinstance(nodes, list):
            nodes = []
        if not isinstance(edges, list):
            edges = []
        nodes.extend(extra_nodes)
        edges.extend(extra_edges)
        graph.nodes_json = json.dumps(nodes)
        graph.edges_json = json.dumps(edges)
        with sqlite_write_guard():
            db.commit()
            db.refresh(graph)
        return to_out(graph)

    diagram = Graph(
        id=new_uuid(),
        project_id=project_id,
        name=name,
        context_text=f"Subsystem {payload.subsystem_id}",
        nfr_json="{}",
        nodes_json=json.dumps(spec["nodes"]),
        edges_json=json.dumps(spec["edges"]),
        owner_team=owner,
        review_status="draft",
    )
    with sqlite_write_guard():
        db.add(diagram)
        db.commit()
        db.refresh(diagram)
    return to_out(diagram)
