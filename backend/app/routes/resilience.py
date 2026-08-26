"""P0.5 — Resilience: failure injection, blast radius, circuit breakers, cost model."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph
from app.models.user import User
from app.routes.auth import get_current_user
from app.routes.graphs import _nfr_out, _parse_json_list
from app.services.blast_radius import compute_blast_radius
from app.services.circuit_breaker import analyze_circuit_breakers
from app.services.cost_model import estimate_cost_breakdown
from app.services.failure_injection import inject_failure
from app.services.live_doc import build_live_doc

router = APIRouter(prefix="/api/v1", tags=["resilience"])


class FailureInjectionRequest(BaseModel):
    node_id: str
    mode: str = "down"
    max_hops: int = Field(default=8, ge=1, le=20)


@router.post("/graphs/{graph_id}/failure-injection")
def failure_injection_graph(
    graph_id: str,
    payload: FailureInjectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return inject_failure(
        nodes,
        edges,
        payload.node_id,
        mode=payload.mode,
        max_hops=payload.max_hops,
    )


@router.post("/graphs/{graph_id}/blast-radius")
def blast_radius_graph(
    graph_id: str,
    payload: FailureInjectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return compute_blast_radius(
        nodes,
        edges,
        payload.node_id,
        max_hops=payload.max_hops,
    )


@router.get("/graphs/{graph_id}/circuit-breakers")
def circuit_breakers_graph(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return analyze_circuit_breakers(nodes, edges)


@router.get("/graphs/{graph_id}/cost-estimate")
def cost_estimate_graph(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return estimate_cost_breakdown(nodes, edges)


@router.get("/graphs/{graph_id}/doc")
def live_doc_graph(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    nfr = _nfr_out(graph)
    return build_live_doc(
        graph.name,
        nodes,
        edges,
        context=getattr(graph, "context_text", None) or "",
        nfr=nfr.model_dump() if nfr else {},
    )
