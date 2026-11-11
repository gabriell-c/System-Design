"""Node annotations API — notes pinned to a node (backed by comments table)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Comment, new_uuid
from app.models.user import User
from app.routes._graph_helpers import get_graph_or_404
from app.routes.auth import get_current_user
from app.services.comments import can_moderate_comment

router = APIRouter(prefix="/api/v1/graphs", tags=["annotations"])


class AnnotationIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    node_id: str = Field(min_length=1, max_length=64)


class AnnotationOut(BaseModel):
    id: str
    graph_id: str
    node_id: str | None
    text: str
    author: str
    created_at: object


def _out(c: Comment) -> AnnotationOut:
    return AnnotationOut(
        id=c.id,
        graph_id=c.graph_id,
        node_id=c.node_id,
        text=c.text,
        author=c.author,
        created_at=c.created_at,
    )


@router.get("/{graph_id}/annotations", response_model=dict)
def list_annotations(
    graph_id: str,
    node_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200, description="Máximo de resultados"),
    offset: int = Query(default=0, ge=0, description="Offset para paginação"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """P1.11 — leitura autenticada (grafo visível para o usuário) + paginação."""
    get_graph_or_404(db, user, graph_id)
    q = db.query(Comment).filter(Comment.graph_id == graph_id, Comment.node_id.isnot(None))
    if node_id:
        q = q.filter(Comment.node_id == node_id)
    base = q.order_by(Comment.created_at.desc())
    total = base.count()
    rows = base.offset(offset).limit(limit).all()
    return {
        "items": [_out(c) for c in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(rows) < total,
    }


@router.post("/{graph_id}/annotations", response_model=AnnotationOut, status_code=201)
def create_annotation(
    graph_id: str,
    payload: AnnotationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # P1.11 — anotação só em grafo visível para o usuário (404 senão).
    get_graph_or_404(db, user, graph_id)
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty annotation")
    comment = Comment(
        id=new_uuid(),
        graph_id=graph_id,
        node_id=payload.node_id.strip(),
        text=text,
        author=user.email if user else "anonymous",
        mentions_json=json.dumps([], ensure_ascii=False),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _out(comment)


@router.delete("/{graph_id}/annotations/{annotation_id}", status_code=204, response_class=Response)
def delete_annotation(
    graph_id: str,
    annotation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    # P1.11 — remoção: autor, dono do grafo ou senior (regra compartilhada).
    graph = get_graph_or_404(db, user, graph_id)
    comment = (
        db.query(Comment)
        .filter(Comment.id == annotation_id, Comment.graph_id == graph_id, Comment.node_id.isnot(None))
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if not can_moderate_comment(db, user, graph, comment):
        raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(comment)
    db.commit()
    return Response(status_code=204)
