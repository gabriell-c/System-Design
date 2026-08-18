from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    context: str = ""
    nfr_json: str = "{}"


class ProjectUpdate(BaseModel):
    name: str | None = None
    context: str | None = None
    nfr_json: str | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    context: str
    nfr_json: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
