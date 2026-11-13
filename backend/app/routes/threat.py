"""R2 — Rota própria de threat modeling heurístico (tag "threat").

GET `/graphs/{id}/threat-analysis`: análise do grafo SALVO (nodes/edges do
DB + `nfr` via `_nfr_out`) — fonte de dados independente do canvas (o
front NÃO lê `store.analysis` aqui).
POST `/graphs/{id}/threat-analysis/live`: body `{nodes, edges, nfr?}` é o
canvas do cliente (preview sem salvar) — itens não-dict → 422 pt-BR,
`nfr` ausente → `{}`, não-dict → 422.

Ownership (IDOR-safe, R1): GET → `get_graph_or_404` (leitura); POST →
`write=True` — no live o body é o canvas, mas o ESCOPO do grafo ainda
precisa existir e ser editável pelo usuário; alheio é 404, nunca 200.

Rate limit: `rate_limit_threat` (60 req/60s por IP+usuário) — threat
heurística é barata e idempotente (sem LLM), mesmo teto do custo, bucket
próprio (`threat:`).

Contrato (b): resposta `{findings, total, by_severity{critical,warning,info},
summary (pt-BR), version: "threat-v2"}` — todo finding heurístico carrega
`model` ("stride" | "linddun", R4f). 429 → `Retry-After` (ApiRateLimitError
no front).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.rate_limit import rate_limit_threat, user_rate_limit_key
from app.routes._graph_helpers import _nfr_out, _parse_json_list, get_graph_or_404
from app.routes.auth import get_current_user
from app.schemas.analysis import Finding
from app.services.threat_analysis import enrich_threat_analysis

router = APIRouter(prefix="/api/v1", tags=["threat"])

THREAT_VERSION = "threat-v2"
SEVERITIES = ("critical", "warning", "info")


class ThreatLiveRequest(BaseModel):
    """Body de POST /graphs/{id}/threat-analysis/live (canvas do cliente).

    `list[Any]` (não `list[dict]`): Pydantic já rejeita lista inválida com
    422; item não-dict dentro da lista é validado no handler
    (`_require_dicts` → 422 pt-BR). `nfr` é `Any` de propósito para poder
    dar a mensagem pt-BR de "deve ser objeto" no handler (Pydantic daria
    422 em inglês).
    """

    nodes: list[Any] = []
    edges: list[Any] = []
    nfr: Any = None


class ThreatSeverityCounts(BaseModel):
    critical: int = 0
    warning: int = 0
    info: int = 0


class ThreatAnalysisOut(BaseModel):
    findings: list[Finding]
    total: int
    by_severity: ThreatSeverityCounts
    summary: str
    version: str = THREAT_VERSION


def _require_dicts(items: list[Any], field: str) -> list[dict[str, Any]]:
    """422 pré-engine: cada entrada de `nodes`/`edges` precisa ser objeto."""
    for item in items:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail=f"'{field}' só aceita lista de objetos")
    return items


def _require_dict(value: Any, field: str) -> dict[str, Any]:
    """422 pré-engine: `nfr` ausente → {}, presente precisa ser objeto."""
    if value is not None and not isinstance(value, dict):
        raise HTTPException(status_code=422, detail=f"'{field}' deve ser um objeto (ou ausente)")
    return value or {}


def _severity_counts(findings: list[Finding]) -> ThreatSeverityCounts:
    tally = {severity: 0 for severity in SEVERITIES}
    for finding in findings:
        tally[finding.severity] += 1
    return ThreatSeverityCounts(**tally)


def _build_out(findings: list[Finding]) -> ThreatAnalysisOut:
    counts = _severity_counts(findings)
    total = len(findings)
    if total == 0:
        summary = "Nenhum check heurístico detectou ameaças — triagem, não substitui threat model formal."
    else:
        summary = (
            f"{total} achado(s) heurístico(s): {counts.critical} crítico(s), "
            f"{counts.warning} de atenção, {counts.info} informativo(s). "
            "Triagem determinística, não auditoria."
        )
    return ThreatAnalysisOut(
        findings=findings,
        total=total,
        by_severity=counts,
        summary=summary,
        version=THREAT_VERSION,
    )


@router.get("/graphs/{graph_id}/threat-analysis", response_model=ThreatAnalysisOut)
def threat_analysis_graph(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ThreatAnalysisOut:
    rate_limit_threat(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    nfr = _nfr_out(graph)
    findings = enrich_threat_analysis(nodes, edges, nfr.model_dump() if nfr is not None else None)
    return _build_out(findings)


@router.post("/graphs/{graph_id}/threat-analysis/live", response_model=ThreatAnalysisOut)
def threat_analysis_live(
    graph_id: str,
    body: ThreatLiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ThreatAnalysisOut:
    rate_limit_threat(request, user_rate_limit_key(current_user))
    # R1: POST → write=True. Alheio é 404 ANTES da validação dos dicts.
    get_graph_or_404(db, current_user, graph_id, write=True)
    nodes = _require_dicts(body.nodes, "nodes")
    edges = _require_dicts(body.edges, "edges")
    nfr = _require_dict(body.nfr, "nfr")
    findings = enrich_threat_analysis(nodes, edges, nfr)
    return _build_out(findings)
