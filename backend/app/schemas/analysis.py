from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["info", "warning", "critical"]


class MetricEstimate(BaseModel):
    label: str
    value: str
    unit: str | None = None
    is_estimate: Literal[True] = True


class Finding(BaseModel):
    node_id: str | None = None
    severity: Severity
    title: str
    detail: str
    metric: MetricEstimate | None = None


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


class ComparisonResult(BaseModel):
    left: AnalysisResult
    right: AnalysisResult
    comparison: dict
