from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.arch_style import (
    CohesionCoupling,
    DomainCoherenceScore,
    ReviewScorecard,
    TradeOffEntry,
)

Severity = Literal["info", "warning", "critical"]


class MetricEstimate(BaseModel):
    label: str
    value: str
    unit: str | None = None
    is_estimate: Literal[True] = True


class FixAction(BaseModel):
    action_type: str
    label: str
    payload: dict = Field(default_factory=dict)


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


class GrowthScenario(BaseModel):
    ok: bool
    issues: list[str] = Field(default_factory=list)
    changes: list[str] = Field(default_factory=list)


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


class ComparisonResult(BaseModel):
    left: AnalysisResult
    right: AnalysisResult
    comparison: dict
