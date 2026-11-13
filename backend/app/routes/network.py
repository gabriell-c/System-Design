"""P2.3 — Rotas de rede enterprise e CI/CD dev/user.

IDOR (R1): os dois GETs passam por `get_graph_or_404` (leitura) — grafo de
terceiro é 404, nunca 200 (sem vazar existência). Rate limit:
`rate_limit_network` (30/60s por IP+usuário) — análise pesada, alinhado com
resiliência (R3). Sem endpoint live: GET só; o hint de stale nos painéis é
coberto no front (dados do grafo salvo — documentado).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.rate_limit import rate_limit_network, user_rate_limit_key
from app.routes._graph_helpers import _parse_json_list, get_graph_or_404
from app.routes.auth import get_current_user
from app.services.deployment import analyze_deployment_flows
from app.services.network_policy import analyze_network_policy

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/graphs/{graph_id}/network-policy")
def network_policy_graph(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    rate_limit_network(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return analyze_network_policy(nodes, edges)


@router.get("/graphs/{graph_id}/deployment-flows")
def deployment_flows_graph(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    rate_limit_network(request, user_rate_limit_key(current_user))
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return analyze_deployment_flows(nodes, edges)
