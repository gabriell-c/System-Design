"""R5 — Rota própria de custo: tabela estática (R1), GET do grafo salvo +
POST `/live` (canvas na mão, preview sem salvar).

Ownership (IDOR-safe): todos os endpoints passam por `get_graph_or_404` —
grafo de terceiro é 404, nunca 200. No POST live o body é o canvas do
cliente, mas o ESCOPO do grafo ainda precisa existir e ser do usuário.

Rate limit: `rate_limit_cost` (60 req/60s por IP+usuário) — custo é barato e
idempotente, então tem bucket próprio, separado dos 30/60s de resiliência
(`rate_limit_resilience`, que cobre injeção de falha, blast radius, circuit
breakers e live doc).

Contrato (b): `GET /graphs/{id}/cost-estimate` mantém o PATH exato do antigo
endpoint do router de resiliência (contrato front preservado) — só muda a
tag OpenAPI ("cost").
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.rate_limit import rate_limit_cost, user_rate_limit_key
from app.routes._graph_helpers import _parse_json_list, get_graph_or_404
from app.routes.auth import get_current_user
from app.schemas.simulation import CostEstimateOut
from app.services.cost_model import estimate_cost_breakdown

router = APIRouter(prefix="/api/v1", tags=["cost"])


class CostLiveRequest(BaseModel):
    """Body de POST /graphs/{id}/cost-estimate/live (canvas do cliente).

    `list[Any]` (não `list[dict]`): Pydantic já rejeita lista inválida com
    422; item não-dict dentro da lista é validado no handler
    (`_require_dicts` → 422). `edges` é aceito no wire (contrato b) mas
    IGNOREDO no engine: `estimate_cost_breakdown` é node-only (contrato (a)
    removeu o parâmetro `edges`).
    """

    nodes: list[Any] = []
    edges: list[Any] = []


def _require_dicts(items: list[Any], field: str) -> list[dict[str, Any]]:
    """422 pré-engine: cada entrada de `nodes`/`edges` precisa ser objeto."""
    for item in items:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail=f"'{field}' só aceita lista de objetos")
    return items


@router.get("/graphs/{graph_id}/cost-estimate", response_model=CostEstimateOut)
def cost_estimate_graph(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CostEstimateOut:
    rate_limit_cost(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    # Contrato (a) é node-only — edges não entram no engine de custo.
    return estimate_cost_breakdown(nodes)


@router.post("/graphs/{graph_id}/cost-estimate/live", response_model=CostEstimateOut)
def cost_estimate_live(
    graph_id: str,
    body: CostLiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CostEstimateOut:
    rate_limit_cost(request, user_rate_limit_key(current_user))
    # IDOR: mesmo com body do canvas, o escopo do grafo precisa existir
    # E ser do usuário → alheio é 404.
    get_graph_or_404(db, current_user, graph_id)
    nodes = _require_dicts(body.nodes, "nodes")
    _require_dicts(body.edges, "edges")  # validado p/ 422, mas ignorado no engine
    return estimate_cost_breakdown(nodes)
