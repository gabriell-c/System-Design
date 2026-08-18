from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.graph import Comment, Graph, new_uuid
from app.schemas.comment import CommentCreate, CommentOut
from app.routes.auth import get_current_user

router = APIRouter(prefix="/graphs", tags=["comments"])


@router.get("/{graph_id}/comments", response_model=List[CommentOut])
def list_comments(graph_id: str, db: Session = Depends(get_db)):
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    return db.query(Comment).filter(Comment.graph_id == graph_id).order_by(Comment.created_at.desc()).all()


@router.post("/{graph_id}/comments", response_model=CommentOut)
def create_comment(graph_id: str, payload: CommentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    comment = Comment(
        id=new_uuid(),
        graph_id=graph_id,
        node_id=payload.node_id,
        text=payload.text.strip(),
        author=user.email if user else "anonymous",
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{graph_id}/comments/{comment_id}")
def delete_comment(graph_id: str, comment_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.graph_id == graph_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    # Only author or admin can delete
    if comment.author != user.email and getattr(user, "role", "") != "senior":
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(comment)
    db.commit()
    return {"ok": True}
