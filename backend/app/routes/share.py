"""P1 — Shareable read-only graph links via share_token."""

from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph
from app.models.user import User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/v1/share", tags=["share"])


class ShareCreateOut(BaseModel):
    share_token: str
    share_url: str
    read_only: bool = True


class ShareGraphOut(BaseModel):
    id: str
    name: str
    context: str = ""
    nodes: list
    edges: list
    read_only: bool = True


@router.post("/graphs/{graph_id}", response_model=ShareCreateOut)
def create_graph_share(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareCreateOut:
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    token = getattr(graph, "share_token", None)
    if not token:
        token = secrets.token_urlsafe(24)
        graph.share_token = token
        db.commit()
        db.refresh(graph)
    return ShareCreateOut(
        share_token=token,
        share_url=f"/share/{token}",
        read_only=True,
    )


@router.delete("/graphs/{graph_id}", status_code=204, response_class=Response)
def revoke_graph_share(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    graph.share_token = None
    db.commit()
    return Response(status_code=204)


@router.get("/{token}", response_model=ShareGraphOut)
def get_shared_graph(token: str, db: Session = Depends(get_db)) -> ShareGraphOut:
    if not token or len(token) < 8:
        raise HTTPException(status_code=400, detail="Invalid token")
    graph = db.query(Graph).filter(Graph.share_token == token).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Shared graph not found")
    try:
        nodes = json.loads(graph.nodes_json or "[]")
        edges = json.loads(graph.edges_json or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Corrupt graph payload") from exc
    return ShareGraphOut(
        id=graph.id,
        name=graph.name,
        context=graph.context_text or "",
        nodes=nodes if isinstance(nodes, list) else [],
        edges=edges if isinstance(edges, list) else [],
        read_only=True,
    )
