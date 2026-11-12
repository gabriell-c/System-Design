"""P0.5 — Resilience: failure injection, blast radius, circuit breakers, live doc.

Ownership (IDOR-safe, item 1): todos os endpoints passam por
`get_graph_or_404` — grafo de terceiro é 404, nunca 200. Helpers vêm de
`app.routes._graph_helpers` (nada de acoplar em `routes.graphs`, item 14).

Rate limit (item 12): 30 req/60s por usuário (rate_limit_resilience) —
diferente dos 5/60s da simulação completa. O endpoint de custo saiu para
a rota própria `app.routes.cost` (R5, tag "cost", limiter 60/60s) — o
PATH GET `/graphs/{id}/cost-estimate` é invariante (contrato front).

Contratos:
- (a) S1b: `inject_failure(nodes, edges, node_id, mode, max_hops)` com
  `RESILIENCE_MAX_HOPS` exportado; `compute_blast_radius(..., mode=...)`.
  O import do fallback abaixo só existe enquanto o S1b não aterrissa —
  remover quando `RESILIENCE_MAX_HOPS` vier do service.
- (c) S3b: modelos de resposta em `app.schemas.simulation`
  (FailureInjectionOut, BlastRadiusOut, CircuitBreakersOut, LiveDocOut;
  CostEstimateOut vive na rota de custo, R5).
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.rate_limit import rate_limit_resilience, user_rate_limit_key
from app.routes._graph_helpers import _nfr_out, _parse_json_list, get_graph_or_404
from app.routes.auth import get_current_user
from app.schemas.simulation import (
    BlastRadiusOut,
    CircuitBreakersOut,
    FailureInjectionOut,
    LiveDocOut,
)
from app.services.blast_radius import compute_blast_radius
from app.services.circuit_breaker import analyze_circuit_breakers
from app.services.failure_injection import inject_failure
from app.services.live_doc import build_live_doc

try:  # S1b (contrato a): RESILIENCE_MAX_HOPS é exportado por failure_injection.
    from app.services.failure_injection import RESILIENCE_MAX_HOPS
except ImportError:  # pragma: no cover - fallback transitório até o S1b aterrisar
    RESILIENCE_MAX_HOPS = 8

router = APIRouter(prefix="/api/v1", tags=["resilience"])


class FailureInjectionRequest(BaseModel):
    node_id: str
    mode: Literal["down", "timeout", "degraded"] = "down"
    max_hops: int = Field(default=RESILIENCE_MAX_HOPS, ge=1, le=20)


def _graph_graph_data(graph: Any) -> tuple[list[dict], list[dict]]:
    return _parse_json_list(graph.nodes_json), _parse_json_list(graph.edges_json)


def _require_node(nodes: list[dict], node_id: str) -> None:
    """422 pré-engine (item 5): nó inexistente é erro do cliente, não
    `HTTP 200 {ok:false}` do engine. Mantido apenas o sucesso da injeção
    como `ok`."""
    known = {str(n.get("id")) for n in nodes if n.get("id")}
    if node_id not in known:
        raise HTTPException(status_code=422, detail=f"Nó '{node_id}' não existe no grafo")


@router.post("/graphs/{graph_id}/failure-injection", response_model=FailureInjectionOut)
def failure_injection_graph(
    graph_id: str,
    payload: FailureInjectionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FailureInjectionOut:
    rate_limit_resilience(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes, edges = _graph_graph_data(graph)
    _require_node(nodes, payload.node_id)
    return inject_failure(
        nodes,
        edges,
        payload.node_id,
        mode=payload.mode,
        max_hops=payload.max_hops,
    )


@router.post("/graphs/{graph_id}/blast-radius", response_model=BlastRadiusOut)
def blast_radius_graph(
    graph_id: str,
    payload: FailureInjectionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BlastRadiusOut:
    rate_limit_resilience(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes, edges = _graph_graph_data(graph)
    _require_node(nodes, payload.node_id)
    # Item 6: o engine agora recebe o mode (contrato a) — antes forçava "down".
    return compute_blast_radius(
        nodes,
        edges,
        payload.node_id,
        mode=payload.mode,
        max_hops=payload.max_hops,
    )


@router.get("/graphs/{graph_id}/circuit-breakers", response_model=CircuitBreakersOut)
def circuit_breakers_graph(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CircuitBreakersOut:
    rate_limit_resilience(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes, _edges = _graph_graph_data(graph)
    return analyze_circuit_breakers(nodes, _edges)


@router.get("/graphs/{graph_id}/doc", response_model=LiveDocOut)
def live_doc_graph(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveDocOut:
    rate_limit_resilience(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes, edges = _graph_graph_data(graph)
    # Item 14: context_text é campo fixo do ORM (sem getattr); _nfr_out
    # nunca devolve None (fallback ProjectNfr()), então `if nfr` era morto.
    nfr = _nfr_out(graph)
    return build_live_doc(
        graph.name,
        nodes,
        edges,
        context=graph.context_text or "",
        nfr=nfr.model_dump(),
    )
