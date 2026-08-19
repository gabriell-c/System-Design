from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    node_id: str | None = None
    text: str
    position_x: float | None = None
    position_y: float | None = None
    assignee: str | None = None
    mentions: list[str] = []
    thread_parent_id: str | None = None


class CommentUpdate(BaseModel):
    text: str | None = None
    resolved: bool | None = None
    assignee: str | None = None


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    node_id: str | None
    text: str
    author: str
    position_x: float | None = None
    position_y: float | None = None
    resolved: bool = False
    assignee: str | None = None
    mentions: list[str] = []
    thread_parent_id: str | None = None
    created_at: datetime
