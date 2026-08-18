from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    context: str = ""
    nfr_json: str = "{}"


class ProjectUpdate(BaseModel):
    name: str | None = None
    context: str | None = None
    nfr_json: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    context: str
    nfr_json: str
    created_at: datetime
    updated_at: datetime

