"""P1.5.5 — Live embed endpoint for read-only diagram view."""

from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph
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


@router.get("/{graph_id}", response_model=EmbedPayload)
def get_embed(graph_id: str, db: Session = Depends(get_db)) -> EmbedPayload:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
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
def embed_token(graph_id: str, db: Session = Depends(get_db)) -> dict:
    """Return embed URL snippet (no auth token — public read-only by graph id)."""
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    base = "/embed"
    return {
        "graph_id": graph_id,
        "embed_url": f"{base}?graph={graph_id}",
        "iframe_snippet": (
            f'<iframe src="{base}?graph={graph_id}" width="100%" height="600" '
            'frameborder="0" title="Archia diagram"></iframe>'
        ),
    }
