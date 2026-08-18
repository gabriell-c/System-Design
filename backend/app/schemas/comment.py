from datetime import datetime
from pydantic import BaseModel


class CommentCreate(BaseModel):
    node_id: str | None = None
    text: str


class CommentOut(BaseModel):
    id: str
    graph_id: str
    node_id: str | None
    text: str
    author: str
    created_at: datetime

    class Config:
        from_attributes = True
