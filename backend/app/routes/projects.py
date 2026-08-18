import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db, sqlite_write_guard
from app.models.graph import Graph, Project, new_uuid
from app.routes.graphs import to_out
from app.schemas.graph import GraphOut, GraphPayload, ProjectNfr
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.subsystems import get_subsystem, list_subsystems as catalog_subsystems, prefix_graph

router = APIRouter(prefix="/projects", tags=["projects"])


class SubsystemImportIn(BaseModel):
    subsystem_id: str = Field(min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=200)
    owner_team: str | None = Field(default=None, max_length=80)
    merge_into_graph_id: str | None = Field(default=None, max_length=36)
    offset_x: float = 0
    offset_y: float = 0


@router.get("/subsystems")
def list_subsystem_catalog():
    return catalog_subsystems()


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.updated_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        id=new_uuid(),
        name=payload.name,
        context=payload.context or "",
        nfr_json=payload.nfr_json or "{}",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.name is not None:
        project.name = payload.name
    if payload.context is not None:
        project.context = payload.context
    if payload.nfr_json is not None:
        project.nfr_json = payload.nfr_json
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


@router.get("/{project_id}/diagrams", response_model=list[GraphOut])
def list_diagrams(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return [to_out(g) for g in project.diagrams]


@router.post("/{project_id}/diagrams", response_model=GraphOut, status_code=201)
def create_diagram(project_id: str, payload: GraphPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    diagram = Graph(
        id=new_uuid(),
        project_id=project_id,
        name=payload.name.strip(),
        context_text=(payload.context or "").strip(),
        nfr_json=(payload.nfr or ProjectNfr()).model_dump_json(),
        nodes_json=json.dumps(payload.nodes),
        edges_json=json.dumps(payload.edges),
        owner_team=payload.owner_team,
        review_status="draft",
    )
    with sqlite_write_guard():
        db.add(diagram)
        db.commit()
        db.refresh(diagram)
    return to_out(diagram)


@router.post("/{project_id}/subsystems/import", response_model=GraphOut, status_code=201)
def import_subsystem(project_id: str, payload: SubsystemImportIn, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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
