from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ReviewStatus = Literal["draft", "analyzed", "pending_review", "approved", "rejected"]
UserRole = Literal["senior", "other"]


class EnvironmentPlan(BaseModel):
    has_dev: bool = True
    has_staging: bool = False
    has_prod: bool = False
    has_ci_cd: bool = False
    has_backups: bool = False
    has_monitoring_plan: bool = False


class ProjectNfr(BaseModel):
    users_per_day: int | None = Field(default=None, ge=0)
    budget_usd_month: float | None = Field(default=None, ge=0)
    availability_pct: float | None = Field(default=None, ge=0, le=100)
    latency_p99_ms: int | None = Field(default=None, ge=0)
    compliance: list[str] = Field(default_factory=list)
    team_size: int | None = Field(default=None, ge=0)
    deadline_weeks: int | None = Field(default=None, ge=0)
    environments: EnvironmentPlan = Field(default_factory=EnvironmentPlan)


class GraphPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    context: str = Field(default="", max_length=20000)
    nfr: ProjectNfr | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class GraphUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    context: str | None = Field(default=None, max_length=20000)
    nfr: ProjectNfr | None = None
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    analysis: dict[str, Any] | None = None


class GraphOut(BaseModel):
    id: str
    name: str
    context: str = ""
    nfr: ProjectNfr | None = None
    nodes: list[Any]
    edges: list[Any]
    analysis: dict[str, Any] | None
    review_status: str
    review_comment: str | None
    reviewer_role: str | None
    created_at: datetime
    updated_at: datetime


class GraphVersionOut(BaseModel):
    id: str
    graph_id: str
    name: str
    nodes: list[Any]
    edges: list[Any]
    created_at: datetime


class AnalyzeRequest(GraphPayload):
    persist_id: str | None = None


class ReviewRequest(BaseModel):
    role: UserRole
    status: ReviewStatus
    comment: str = Field(min_length=8, max_length=4000)


class CompareRequest(BaseModel):
    left: GraphPayload
    right: GraphPayload
