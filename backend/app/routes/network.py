"""P2.3 — Rotas de rede enterprise e CI/CD dev/user."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph
from app.routes.graphs import _parse_json_list
from app.services.deployment import analyze_deployment_flows
from app.services.network_policy import analyze_network_policy

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/graphs/{graph_id}/network-policy")
def network_policy_graph(graph_id: str, db: Session = Depends(get_db)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return analyze_network_policy(nodes, edges)


@router.get("/graphs/{graph_id}/deployment-flows")
def deployment_flows_graph(graph_id: str, db: Session = Depends(get_db)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return analyze_deployment_flows(nodes, edges)
