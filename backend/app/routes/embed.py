"""P1.5.5 — Live embed endpoint for read-only diagram view."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, Project
from app.models.user import User
from app.routes.auth import get_current_user
from app.routes.graphs import _nfr_out, _parse_json_list

router = APIRouter(prefix="/api/v1/embed", tags=["embed"])


class EmbedPayload(BaseModel):
    graph_id: str
    name: str
    nodes: list
    edges: list
    context: str = ""
    nfr: dict | None = None
    read_only: bool = True


def _assert_embed_allowed(db: Session, graph: Graph) -> None:
    """Public embeds only for projects marked is_public (or orphan graphs)."""
    if not graph.project_id:
        return
    project = db.get(Project, graph.project_id)
    if project is None:
        return
    if not project.is_public:
        raise HTTPException(
            status_code=403,
            detail="Embed disponível apenas para projetos públicos",
        )


@router.get("/{graph_id}", response_model=EmbedPayload)
def get_embed(graph_id: str, db: Session = Depends(get_db)) -> EmbedPayload:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    _assert_embed_allowed(db, graph)
    nfr = _nfr_out(graph)
    return EmbedPayload(
        graph_id=graph.id,
        name=graph.name,
        nodes=_parse_json_list(graph.nodes_json),
        edges=_parse_json_list(graph.edges_json),
        context=getattr(graph, "context_text", "") or "",
        nfr=nfr.model_dump() if nfr else None,
        read_only=True,
    )


@router.get("/{graph_id}/token")
def embed_token(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return embed URL snippet — requires auth; graph must be on a public project."""
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    _assert_embed_allowed(db, graph)
    _ = current_user
    base = "/embed"
    return {
        "graph_id": graph_id,
        "embed_url": f"{base}?graph={graph_id}",
        "iframe_snippet": (
            f'<iframe src="{base}?graph={graph_id}" width="100%" height="600" '
            'frameborder="0" title="Archia diagram"></iframe>'
        ),
    }
