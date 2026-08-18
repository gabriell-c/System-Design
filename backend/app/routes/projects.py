from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, Project
from app.models.user import User
from app.schemas.graph import GraphOut, GraphUpdate
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    """List all projects."""
    return db.query(Project).order_by(Project.updated_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project."""
    project = Project(
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
    """Get project by ID with its diagrams."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)):
    """Update project."""
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
    """Delete project and all its diagrams."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()


@router.get("/{project_id}/diagrams", response_model=list[GraphOut])
def list_diagrams(project_id: str, db: Session = Depends(get_db)):
    """List all diagrams (graphs) in a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project.diagrams


@router.post("/{project_id}/diagrams", response_model=GraphOut, status_code=201)
def create_diagram(project_id: str, payload: GraphUpdate, db: Session = Depends(get_db)):
    """Create a new diagram in a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    diagram = Graph(
        project_id=project_id,
        name=payload.name,
        context_text=payload.context_text or "",
        nfr_json=payload.nfr_json or "{}",
        nodes_json=payload.nodes_json or "[]",
        edges_json=payload.edges_json or "[]",
    )
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    return diagram
