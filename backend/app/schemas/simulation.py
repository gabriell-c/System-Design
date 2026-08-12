from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LoadType = Literal["spike", "constant", "gradual", "periodic"]
TestMode = Literal["load", "stress", "soak"]
OutputFormat = Literal["json", "csv", "prometheus"]
JourneyStepKind = Literal[
    "landing",
    "browse",
    "auth",
    "read",
    "write",
    "checkout",
    "payment",
    "confirm",
]


class LoadScenario(BaseModel):
    name: str = "Carga padrão"
    description: str = ""
    type: LoadType = "gradual"
    requests_per_second: int = Field(default=100, ge=1, le=100_000)
    duration_seconds: int = Field(default=60, ge=1, le=3600)
    burst_multiplier: float = Field(default=3.0, ge=1.0, le=50.0)
    concurrent_users: int = Field(default=50, ge=1, le=50_000)


class JourneyStep(BaseModel):
    id: str
    name: str
    kind: JourneyStepKind = "browse"
    weight: float = Field(default=1.0, ge=0.01, le=100.0)
    think_time_ms: int = Field(default=800, ge=0, le=60_000)
    drop_off_rate: float = Field(default=0.05, ge=0.0, le=0.95)


class UserJourney(BaseModel):
    name: str = "Jornada padrão"
    steps: list[JourneyStep] = Field(default_factory=list)
    concurrent_users: int = Field(default=100, ge=1, le=20_000)
    think_time_ms: int = Field(default=1000, ge=0, le=60_000)


class EventPattern(BaseModel):
    event_type: str
    trigger_probability: float = Field(default=0.1, ge=0.0, le=1.0)
    cascade_enabled: bool = True
    dependent_events: list[str] = Field(default_factory=list)
    severity: Literal["info", "warning", "critical"] = "warning"


class ValidationRule(BaseModel):
    metric: str
    min_value: float | None = None
    max_value: float | None = None
    required: bool = True


class SimulationRequest(BaseModel):
    name: str = "Simulação"
    context: str = ""
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    seed: int = Field(default=42, ge=0)
    realism_level: float = Field(default=0.65, ge=0.0, le=1.0)
    test_mode: TestMode = "load"
    load: LoadScenario | None = None
    journey: UserJourney | None = None
    events: list[EventPattern] = Field(default_factory=list)
    validation_rules: list[ValidationRule] = Field(default_factory=list)
    output_format: OutputFormat = "json"
    include_timeline: bool = True


class ComponentCapacity(BaseModel):
    """Capacidade individual de um componente na arquitetura."""
    component: str
    tech: str
    kind: str
    capacity_rps: float
    max_connections: int
    utilization_pct: float
    is_bottleneck: bool = False


class EngineeringAudit(BaseModel):
    """Análise de engenharia detalhada dos gargalos e pontos de falha."""
    bottleneck_component: str | None = None
    bottleneck_tech: str | None = None
    bottleneck_rps: float = 0.0
    system_capacity_rps: float = 0.0
    headroom_pct: float = 0.0
    component_capacities: list[ComponentCapacity] = Field(default_factory=list)
    failure_scenarios: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class Bottleneck(BaseModel):
    node_id: str | None = None
    component: str
    reason: str
    severity: Literal["info", "warning", "critical"]
    saturation_pct: float


class LoadPoint(BaseModel):
    t_seconds: int
    rps: float
    error_rate: float
    p95_ms: float
    saturated: bool


class LoadReport(BaseModel):
    scenario_name: str
    type: LoadType
    peak_rps: float
    avg_rps: float
    estimated_capacity_rps: float
    saturation_at_seconds: int | None
    error_rate_peak: float
    bottlenecks: list[Bottleneck] = Field(default_factory=list)
    timeline: list[LoadPoint] = Field(default_factory=list)
    ok: bool


class JourneyStepResult(BaseModel):
    step_id: str
    name: str
    kind: JourneyStepKind
    entered: int
    completed: int
    dropped: int
    success_rate: float
    avg_latency_ms: float


class JourneyReport(BaseModel):
    journey_name: str
    concurrent_users: int
    conversion_rate: float
    steps: list[JourneyStepResult] = Field(default_factory=list)
    drop_off_hotspots: list[str] = Field(default_factory=list)
    ok: bool


class TriggeredEvent(BaseModel):
    event_type: str
    triggered: bool
    roll: float
    cascade: list[str] = Field(default_factory=list)
    impact: str
    severity: Literal["info", "warning", "critical"]


class EventReport(BaseModel):
    triggered_count: int
    events: list[TriggeredEvent] = Field(default_factory=list)
    cascade_depth: int
    ok: bool


class ValidationResult(BaseModel):
    metric: str
    passed: bool
    actual: float | None
    expected_min: float | None = None
    expected_max: float | None = None
    detail: str


class SimulationResult(BaseModel):
    seed: int
    realism_score: float
    reproducible: bool = True
    estimated_capacity_rps: float
    test_mode: TestMode = "load"
    summary: str
    load: LoadReport | None = None
    journey: JourneyReport | None = None
    events: EventReport | None = None
    validations: list[ValidationResult] = Field(default_factory=list)
    validations_passed: bool = True
    findings: list[str] = Field(default_factory=list)
    engineering_audit: EngineeringAudit | None = None
    export_body: str | None = None
    export_content_type: str | None = None
    presets_used: list[str] = Field(default_factory=list)


class SimulationPreset(BaseModel):
    id: str
    label: str
    description: str
    load: LoadScenario | None = None
    journey: UserJourney | None = None
    events: list[EventPattern] = Field(default_factory=list)
