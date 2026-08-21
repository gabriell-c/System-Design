from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProjectAccessEntry(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    role: Literal["read", "full"] = "read"


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    context: str = ""
    nfr_json: str = "{}"
    is_public: bool = False
    access_list: list[ProjectAccessEntry] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    context: str | None = None
    nfr_json: str | None = None
    is_public: bool | None = None
    pinned: bool | None = None
    archived: bool | None = None
    access_list: list[ProjectAccessEntry] | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    context: str
    description: str = ""
    nfr_json: str
    is_public: bool = False
    archived: bool = False
    pinned: bool = False
    share_token: str | None = None
    created_at: datetime
    updated_at: datetime
    access_list: list[ProjectAccessEntry] = Field(default_factory=list)
    diagram_count: int = 0
    node_count: int = 0


class ShareUrlOut(BaseModel):
    share_url: str
    share_token: str
    is_public: bool
