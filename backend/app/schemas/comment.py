from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    node_id: str | None = None
    text: str


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    node_id: str | None
    text: str
    author: str
    created_at: datetime
