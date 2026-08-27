"""Node annotations API — notes pinned to a node (backed by comments table)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Comment, Graph, new_uuid
from app.models.user import User
from app.routes.auth import get_current_user

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


@router.get("/{graph_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(graph_id: str, node_id: str | None = None, db: Session = Depends(get_db)):
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    q = db.query(Comment).filter(Comment.graph_id == graph_id, Comment.node_id.isnot(None))
    if node_id:
        q = q.filter(Comment.node_id == node_id)
    rows = q.order_by(Comment.created_at.desc()).all()
    return [_out(c) for c in rows]


@router.post("/{graph_id}/annotations", response_model=AnnotationOut, status_code=201)
def create_annotation(
    graph_id: str,
    payload: AnnotationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
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
    comment = (
        db.query(Comment)
        .filter(Comment.id == annotation_id, Comment.graph_id == graph_id, Comment.node_id.isnot(None))
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if comment.author != user.email and getattr(user, "role", "") != "senior":
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(comment)
    db.commit()
    return Response(status_code=204)
