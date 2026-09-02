import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Comment, Graph, new_uuid
from app.routes.auth import get_current_user
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate
from app.services.comments import extract_mentions, notify_mentions
from app.routes.ws import broadcast_comment_event

router = APIRouter(prefix="/api/v1/graphs", tags=["comments"])


def _comment_out(comment: Comment) -> CommentOut:
    try:
        mentions = json.loads(comment.mentions_json or "[]")
    except json.JSONDecodeError:
        mentions = []
    return CommentOut(
        id=comment.id,
        graph_id=comment.graph_id,
        node_id=comment.node_id,
        text=comment.text,
        author=comment.author,
        position_x=comment.position_x,
        position_y=comment.position_y,
        resolved=bool(comment.resolved),
        assignee=comment.assignee,
        mentions=mentions if isinstance(mentions, list) else [],
        thread_parent_id=comment.thread_parent_id,
        created_at=comment.created_at,
    )


@router.get("/{graph_id}/comments", response_model=list[CommentOut])
def list_comments(graph_id: str, db: Session = Depends(get_db)):
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    rows = db.query(Comment).filter(Comment.graph_id == graph_id).order_by(Comment.created_at.desc()).all()
    return [_comment_out(c) for c in rows]


@router.post("/{graph_id}/comments", response_model=CommentOut)
def create_comment(graph_id: str, payload: CommentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    text = payload.text.strip()
    mentions = payload.mentions or extract_mentions(text)
    comment = Comment(
        id=new_uuid(),
        graph_id=graph_id,
        node_id=payload.node_id,
        text=text,
        author=user.email if user else "anonymous",
        position_x=payload.position_x,
        position_y=payload.position_y,
        assignee=payload.assignee,
        mentions_json=json.dumps(mentions, ensure_ascii=False),
        thread_parent_id=payload.thread_parent_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    notify_mentions(mentions, graph_id, text)
    out = _comment_out(comment)
    broadcast_comment_event(graph_id, "comment.created", out.model_dump(mode="json"))
    return out


@router.patch("/{graph_id}/comments/{comment_id}", response_model=CommentOut)
def update_comment(
    graph_id: str,
    comment_id: str,
    payload: CommentUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.graph_id == graph_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if payload.text is not None:
        comment.text = payload.text.strip()
        comment.mentions_json = json.dumps(extract_mentions(comment.text), ensure_ascii=False)
    if payload.resolved is not None:
        comment.resolved = payload.resolved
    if payload.assignee is not None:
        comment.assignee = payload.assignee.strip() or None
    db.commit()
    db.refresh(comment)
    out = _comment_out(comment)
    broadcast_comment_event(graph_id, "comment.updated", out.model_dump(mode="json"))
    return out


@router.delete("/{graph_id}/comments/{comment_id}")
def delete_comment(graph_id: str, comment_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.graph_id == graph_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author != user.email and getattr(user, "role", "") != "senior":
        raise HTTPException(status_code=403, detail="Not authorized")
    cid = comment.id
    db.delete(comment)
    db.commit()
    broadcast_comment_event(graph_id, "comment.deleted", {"id": cid})
    return {"ok": True}
