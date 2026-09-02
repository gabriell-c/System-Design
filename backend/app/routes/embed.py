"""P1.5.5 / P3.2.2 — Live embed endpoint for read-only diagram view (JSON + SVG)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, Project
from app.models.user import User
from app.routes.auth import get_current_user
from app.routes.graphs import _nfr_out, _parse_json_list
from app.services.embed_svg import render_embed_svg

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


def _load_embed_graph(db: Session, graph_id: str) -> Graph:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    _assert_embed_allowed(db, graph)
    return graph


@router.get("/{graph_id}", response_model=EmbedPayload)
def get_embed(graph_id: str, db: Session = Depends(get_db)) -> EmbedPayload:
    graph = _load_embed_graph(db, graph_id)
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


@router.get("/{graph_id}/svg")
def get_embed_svg(
    graph_id: str,
    theme: str = Query(default="light", pattern="^(light|dark)$"),
    db: Session = Depends(get_db),
) -> Response:
    """Return live SVG of the diagram (Notion/Confluence-friendly)."""
    graph = _load_embed_graph(db, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    svg = render_embed_svg(nodes, edges, theme=theme)  # type: ignore[arg-type]
    return Response(
        content=svg,
        media_type="image/svg+xml; charset=utf-8",
        headers={
            "Cache-Control": "public, max-age=60",
            "Content-Disposition": f'inline; filename="archia-{graph_id[:8]}.svg"',
        },
    )


@router.get("/{graph_id}/token")
def embed_token(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return embed URL snippet — requires auth; graph must be on a public project."""
    graph = _load_embed_graph(db, graph_id)
    _ = current_user
    base = "/embed"
    return {
        "graph_id": graph_id,
        "embed_url": f"{base}?graph={graph_id}",
        "svg_url": f"/api/v1/embed/{graph_id}/svg?theme=light",
        "iframe_snippet": (
            f'<iframe src="{base}?graph={graph_id}&theme=light" width="100%" height="600" '
            f'frameborder="0" title="Archia — {graph.name}" loading="lazy"></iframe>'
        ),
    }
