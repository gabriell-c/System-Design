import logging
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.arch_style import (
    CohesionCoupling,
    DomainCoherenceScore,
    ReviewScorecard,
    TradeOffEntry,
)

logger = logging.getLogger(__name__)

Severity = Literal["info", "warning", "critical"]

# Escala da UI é 0-10: scores vindos de LLMs fora da banda são truncados
# (tolerante, com warning), nunca rejeitam o relatório inteiro.
SCORE_MIN = 0.0
SCORE_MAX = 10.0


class MetricEstimate(BaseModel):
    label: str
    value: str
    unit: str | None = None
    is_estimate: Literal[True] = True


class FixAction(BaseModel):
    action_type: str
    label: str
    payload: dict = Field(default_factory=dict)
    # Item 35 — campos aditivos (presentes quando o LLM propõe correção
    # ancorada em catálogo/zona; validação do payload é do sibling web).
    catalog_id: str | None = None
    zone_kind: str | None = None


class ScoreFactor(BaseModel):
    label: str
    impact: float
    detail: str = ""


class ScoreBreakdown(BaseModel):
    base_score: float
    explained_score: float
    factors: list[ScoreFactor] = Field(default_factory=list)
    critical_node_ids: list[str] = Field(default_factory=list)
    finding_counts: dict[str, int] = Field(default_factory=dict)


class DomainBenchmark(BaseModel):
    domain: str
    triggered_rules: list[str] = Field(default_factory=list)
    status: str = "pass"


class Finding(BaseModel):
    node_id: str | None = None
    severity: Severity
    title: str
    detail: str
    metric: MetricEstimate | None = None
    fix_action: FixAction | None = None
    # Nós/arestas que contribuíram para este finding (evidência para o scorecard).
    evidence_node_ids: list[str] = Field(default_factory=list)
    # Item 39 — origem do finding: "heuristica", a chave do agente (ex.:
    # "security") ou "consolidador". None só em dados antigos (cache legado).
    agent: str | None = None
    # Threat heurístico: "stride" | "linddun"; None nos demais findings.
    model: str | None = None


class GrowthScenario(BaseModel):
    ok: bool
    issues: list[str] = Field(default_factory=list)
    changes: list[str] = Field(default_factory=list)
    # Por quê: derivado de dados (capacidade vs alvo) ou explicação de dados faltantes.
    why: str | None = None


class GrowthReport(BaseModel):
    small: GrowthScenario
    medium: GrowthScenario
    large: GrowthScenario


class AgentReport(BaseModel):
    agent: str
    score: float
    findings: list[Finding] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    growth: GrowthReport | None = None
    # Item 34 — campo obrigatório no schema do consolidator (default vazio):
    # resumo de 1–3 frases em pt-BR. Outros agentes deixam vazio.
    summary: str = ""

    @field_validator("score", mode="after")
    @classmethod
    def _clamp_score(cls, value: float) -> float:
        clamped = max(SCORE_MIN, min(SCORE_MAX, value))
        if clamped != value:
            logger.warning("agent_score_clamped raw=%s clamped=%s", value, clamped)
        return clamped


class LlmUsage(BaseModel):
    """Item 27 — tokens agregados da execução (0 quando o provider não
    reportou uso em uma chamada; total_calls = chamadas HTTP efetivadas)."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_calls: int = 0


class AnalysisResult(BaseModel):
    score: float
    summary: str
    strengths: list[str]
    risks: list[str]
    suggestions: list[str]
    findings: list[Finding]
    node_scores: dict[str, float]
    growth: GrowthReport
    ia_ok: bool
    ia_unavailable: bool
    agents_used: list[str]

    arch_style: str | None = None
    style_confidence: float = 0.0
    domain_coherence: DomainCoherenceScore | None = None
    cohesion_coupling: CohesionCoupling | None = None
    trade_offs: list[TradeOffEntry] = Field(default_factory=list)
    style_findings: list[Finding] = Field(default_factory=list)
    review_scorecard: ReviewScorecard | None = None
    score_breakdown: ScoreBreakdown | None = None
    benchmarks: list[DomainBenchmark] = Field(default_factory=list)
    threat_findings: list[Finding] = Field(default_factory=list)
    well_architected: ReviewScorecard | None = None
    # Item 26 — True quando a resposta veio do cache de fingerprint (sem LLM).
    cached: bool = False
    # Item 27 — contagem por CompleteResult.ok (7 agentes + consolidador).
    agents_done: int = 0
    agents_failed: int = 0
    # Item 27 — uso agregado de LLM (None quando nenhuma chamada ocorreu).
    usage: LlmUsage | None = None


class ComparisonResult(BaseModel):
    left: AnalysisResult
    right: AnalysisResult
    comparison: dict
