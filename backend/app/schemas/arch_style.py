from typing import Literal

from pydantic import BaseModel, Field

# Estilos arquiteturais suportados
ArchStyle = Literal[
    "monolithic",
    "layered",
    "microservices",
    "event_driven",
    "hexagonal",
    "serverless",
    "soa"
]

FailureBehavior = Literal["retry", "fallback", "dlq", "fail_fast", "none"]


class ArchStyleInfo(BaseModel):
    nome: str
    descricao_curta: str
    quando_usar: str
    riscos_tipicos: list[str]

# Coerência entre domínios (AN/AD/AA/AI)
class DomainCoherenceScore(BaseModel):
    an: float = Field(ge=0, le=10)
    ad: float = Field(ge=0, le=10)
    aa: float = Field(ge=0, le=10)
    ai: float = Field(ge=0, le=10)
    geral: float = Field(ge=0, le=10)

# Métricas de coesão e acoplamento
class CohesionCoupling(BaseModel):
    cohesion_score: float = Field(ge=0, le=10)
    coupling_score: float = Field(ge=0, le=10)
    por_dominio: dict[str, float] = {}  # Scores por domínio (AN/AD/AA/AI)

# Trade-offs documentados
class TradeOffEntry(BaseModel):
    decisao: str
    alternativa_rejeitada: str
    vantagem: str
    desvantagem: str
    criterio_escolha: str


class FailureMode(BaseModel):
    """Modo de falha explícito amarrado a um componente."""

    component_id: str
    mode: str
    impact: str
    mitigation: str


class ReviewScorecard(BaseModel):
    """Scorecard de design review (0–10 por eixo). review_ready se geral >= 8 e nenhum eixo < 5."""

    narrative: float = Field(ge=0, le=10)
    views_completeness: float = Field(ge=0, le=10)
    placement: float = Field(ge=0, le=10)
    flow_continuity: float = Field(ge=0, le=10)
    operability: float = Field(ge=0, le=10)
    decision_quality: float = Field(ge=0, le=10)
    overall: float = Field(ge=0, le=10)
    review_ready: bool = False
    gaps: list[str] = Field(default_factory=list)