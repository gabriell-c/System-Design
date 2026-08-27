"""
Rota que converte texto livre em diagrama Mermaid e persiste no banco.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, new_uuid
from app.models.user import User
from app.routes.auth import get_current_user
from app.routes.graphs import to_out
from app.schemas.graph import GraphOut
from app.services.diagram_text_to_mermaid import parse_text_to_mermaid

router = APIRouter(prefix="/api/v1")

class TextToDiagramIn(BaseModel):
    text: str = Field(..., min_length=1)
    name: str = Field(default="Diagrama gerado")

@router.post("/diagrams/text-to-mermaid", response_model=GraphOut, status_code=201)
def create_diagram_from_text(
    project_id: str,
    payload: TextToDiagramIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.routes.projects import _get_project
    _get_project(db, project_id)

    diagram_type, mermaid_code = parse_text_to_mermaid(payload.text)

    graph = Graph(
        id=new_uuid(),
        project_id=project_id,
        name=payload.name,
        context_text=mermaid_code,
        nfr_json="{}",
        nodes_json="[]",
        edges_json="[]",
        review_status="draft",
        diagram_kind="text_generated",
    )
    db.add(graph)
    db.commit()
    db.refresh(graph)
    return to_out(graph)