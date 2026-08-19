from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.arch_style import ArchStyle, FailureMode

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

    # Estilo + domínios AN/AD
    arch_style: ArchStyle | None = None
    business_processes: list[str] = Field(default_factory=list)
    data_entities: list[str] = Field(default_factory=list)
    data_governance: list[str] = Field(default_factory=list)

    # SLOs explícitos (podem espelhar availability/latency NFR)
    slo_availability_pct: float | None = Field(default=None, ge=0, le=100)
    slo_latency_p99_ms: int | None = Field(default=None, ge=0)
    critical_path_edge_ids: list[str] = Field(default_factory=list)
    failure_modes: list[FailureMode] = Field(default_factory=list)

    # P1.1: Dados Profundos
    data_ownership: list[dict[str, Any]] = Field(default_factory=list)
    api_contracts: list[dict[str, Any]] = Field(default_factory=list)
    event_topics: list[dict[str, Any]] = Field(default_factory=list)
    consistency_patterns: dict[str, str] = Field(default_factory=dict)
    data_lineage: list[dict[str, Any]] = Field(default_factory=list)
    rpo_hours: float | None = Field(default=None, ge=0)
    rto_minutes: int | None = Field(default=None, ge=0)

    # P1.2.5: Cenários de simulação persistidos
    simulation_scenarios: list[dict[str, Any]] = Field(default_factory=list)


class GraphPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    context: str = Field(default="", max_length=20000)
    nfr: ProjectNfr | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    project_id: str | None = Field(default=None, max_length=36)
    owner_team: str | None = Field(default=None, max_length=80)
    diagram_kind: str | None = Field(default=None, max_length=32)
    parent_graph_id: str | None = Field(default=None, max_length=36)
    c4_parent_node_id: str | None = Field(default=None, max_length=36)


class GraphUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    context: str | None = Field(default=None, max_length=20000)
    nfr: ProjectNfr | None = None
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    analysis: dict[str, Any] | None = None
    project_id: str | None = Field(default=None, max_length=36)
    owner_team: str | None = Field(default=None, max_length=80)
    diagram_kind: str | None = Field(default=None, max_length=32)
    parent_graph_id: str | None = Field(default=None, max_length=36)
    c4_parent_node_id: str | None = Field(default=None, max_length=36)


class TeamAccess(BaseModel):
    """P2.2.3 — permissão por squad."""
    team: str
    role: Literal["read", "write", "admin"]


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
    project_id: str | None = None
    owner_team: str | None = None
    diagram_kind: str | None = None
    parent_graph_id: str | None = None
    c4_parent_node_id: str | None = None
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
