from __future__ import annotations

import warnings
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LoadType = Literal["spike", "constant", "gradual", "periodic"]
TestMode = Literal["load", "stress", "soak"]
OutputFormat = Literal["json", "csv", "prometheus"]
# Whitelist de métricas de validação (contrato S1a / item 9): o engine só
# conhece estas métricas. Valor fora da lista nunca chega ao engine —
# Pydantic responde 422 na rota.
ValidationMetric = Literal[
    "capacity_rps",
    "realism_score",
    "peak_rps",
    "error_rate_peak",
    "avg_rps",
    "conversion_rate",
]
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
    """Regra de validação pós-simulação.

    Contrato com o engine (S1a): `metric` é whitelist fechada
    (`ValidationMetric`) — métrica desconhecida já é 422 no schema e nem
    chega ao engine. Regra fail-closed: se a métrica não estiver no
    resultado da simulação e `required=True`, o engine devolve
    `passed=False` (falha por omissão, nunca sucesso).
    """

    metric: ValidationMetric
    min_value: float | None = None
    max_value: float | None = None
    required: bool = True


class SimulationRequest(BaseModel):
    """Entrada do engine de simulação (contrato S1a).

    `context` afeta o audit/summary do resultado (o engine o consome no
    cálculo de realismo e no texto de resumo) — contrato (b).
    """

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
    # Renomeado de `cascade_depth` (contrato S1a / item 10): largura máxima
    # do leque de cascata, não profundidade — o front (S3b) consome o novo
    # nome.
    max_cascade_fanout: int
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


class SimulationScenarioPayload(BaseModel):
    """Payload tipado de cenário de simulação salvo em grafo (P1 / item 8).

    Espelha `SimulationRequest` + `PresetRunRequest` em campos opcionais
    coerentes. `preset_id` (quando presente) resolve via `list_presets()`;
    senão o engine roda em "request direto" com os campos deste payload.

    Compatibilidade documentada: payloads antigos free-form continuam
    válidos — chaves desconhecidas são MANTIDAS (`extra="allow"`) e apenas
    avisam (model_validator permissivo abaixo), nunca rejeitam. Chaves
    CONHECIDAS (seed, test_mode, ...) são tipadas: valor fora de bounds é
    422 na execução do cenário.
    """

    model_config = ConfigDict(extra="allow")

    preset_id: str | None = None
    context: str = ""
    name: str | None = None
    seed: int = Field(default=42, ge=0)
    realism_level: float = Field(default=0.65, ge=0.0, le=1.0)
    test_mode: TestMode = "load"
    output_format: OutputFormat = "json"
    load: LoadScenario | None = None
    journey: UserJourney | None = None
    events: list[EventPattern] = Field(default_factory=list)
    validation_rules: list[ValidationRule] = Field(default_factory=list)
    include_timeline: bool = True

    @model_validator(mode="before")
    @classmethod
    def _warn_legacy_unknown_keys(cls, data: Any) -> Any:
        """Permissivo com payload legado: chaves desconhecidas passam e avisam."""
        if isinstance(data, dict):
            unknown = set(data) - set(cls.model_fields)
            if unknown:
                warnings.warn(
                    "SimulationScenarioPayload: chaves desconhecidas são mantidas "
                    f"por compatibilidade com payload legado e ignoradas pelo engine: "
                    f"{sorted(unknown)}",
                    stacklevel=2,
                )
        return data


# ---------------------------------------------------------------------------
# Modelos de resposta P0.5 (resilience) — contrato (c): o front (S3b) gera o
# TypeScript contra estes shapes. Os services devolvem dicts; o FastAPI os
# valida via response_model. Pydantic v2 ignora campos não declarados no
# dict de entrada — novos campos de serviço exigem atualização aqui.
# ---------------------------------------------------------------------------


class FailureInjectionOut(BaseModel):
    """POST /graphs/{id}/failure-injection (sucesso; falha de nó ausente é
    422 na rota — `ok` aqui é apenas o sucesso da injeção)."""

    ok: bool
    failed_node_id: str | None = None
    failed_label: str | None = None
    mode: str | None = None
    mode_detail: str | None = None
    error: str | None = None
    unreachable_node_ids: list[str] = Field(default_factory=list)
    degraded_node_ids: list[str] = Field(default_factory=list)
    fallback_activations: list[dict] = Field(default_factory=list)
    critical_path_broken: int = 0
    critical_path_total: int = 0
    journeys_broken_pct: float = 0.0
    affected_node_ids: list[str] = Field(default_factory=list)
    summary: str | None = None


class BlastRadiusOut(BaseModel):
    """POST /graphs/{id}/blast-radius. `hops` é mapa str(hop)->[node_ids]."""

    ok: bool
    error: str | None = None
    origin_node_id: str | None = None
    origin_label: str | None = None
    mode: str | None = None
    max_hops: int = 0
    hops: dict[str, list[str]] = Field(default_factory=dict)
    affected_node_ids: list[str] = Field(default_factory=list)
    unreachable_node_ids: list[str] = Field(default_factory=list)
    degraded_node_ids: list[str] = Field(default_factory=list)
    highlight_edge_ids: list[str] = Field(default_factory=list)
    highlight_edges: list[dict] = Field(default_factory=list)
    journeys_broken_pct: float = 0.0
    critical_path_broken: int = 0
    node_labels: dict[str, str] = Field(default_factory=dict)
    summary: str | None = None


class CircuitBreakersOut(BaseModel):
    """GET /graphs/{id}/circuit-breakers. Itens de `breakers` variam
    (nó vs aresta) → dict."""

    breakers: list[dict] = Field(default_factory=list)
    breaker_count: int = 0
    gaps: list[str] = Field(default_factory=list)
    recommendation: str = ""


class CostLineItemOut(BaseModel):
    """Linha de `line_items` em GET /graphs/{id}/cost-estimate."""

    node_id: str
    label: str
    catalog_id: str
    region: str
    tier: str
    cost_key: str
    cost_usd_month: float


class CostEstimateOut(BaseModel):
    """GET /graphs/{id}/cost-estimate."""

    line_items: list[CostLineItemOut] = Field(default_factory=list)
    total_usd_month: float = 0.0
    heuristic_total_usd_month: float = 0.0
    by_region: dict[str, float] = Field(default_factory=dict)
    by_tier: dict[str, float] = Field(default_factory=dict)
    node_count: int = 0
    summary: str = ""


class LiveDocOut(BaseModel):
    """GET /graphs/{id}/doc. `anchors` é mapa node_id -> âncora
    (ex.: 'node-api')."""

    markdown: str
    anchors: dict[str, str] = Field(default_factory=dict)
    updated_at: str = ""
