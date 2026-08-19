"""P0.4 / P0.1.6 / P0.5 / P2.1 — Rotas de governança e pacote."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, Project
from app.routes.graphs import _nfr_out, _parse_json_list, to_out
from app.services.benchmark import run_graph_benchmark
from app.services.diagram_consistency import analyze_project_consistency
from app.services.governance import build_raci_matrix, persist_adrs_markdown
from app.services.policy import evaluate_policies
from app.services.slo import compute_service_slos, error_budget_burn_rate

router = APIRouter(prefix="/api/v1", tags=["governance"])


class AdrPersistIn(BaseModel):
    adrs: list[dict] = Field(default_factory=list)


def _project_graphs(db: Session, project_id: str) -> list[Graph]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return list(project.diagrams)


@router.get("/projects/{project_id}/consistency")
def project_consistency(project_id: str, db: Session = Depends(get_db)) -> dict:
    graphs = _project_graphs(db, project_id)
    payload = [
        {
            "id": g.id,
            "name": g.name,
            "diagram_kind": getattr(g, "diagram_kind", None),
            "nodes": _parse_json_list(g.nodes_json),
        }
        for g in graphs
    ]
    return analyze_project_consistency(payload)


@router.get("/projects/{project_id}/policy")
def project_policy(project_id: str, db: Session = Depends(get_db)) -> dict:
    graphs = _project_graphs(db, project_id)
    all_findings: list[dict] = []
    for g in graphs:
        nodes = _parse_json_list(g.nodes_json)
        edges = _parse_json_list(g.edges_json)
        for f in evaluate_policies(nodes, edges):
            f["graph_id"] = g.id
            f["graph_name"] = g.name
            all_findings.append(f)
    return {"ok": len(all_findings) == 0, "findings": all_findings}


@router.get("/projects/{project_id}/raci")
def project_raci(project_id: str, db: Session = Depends(get_db)) -> dict:
    graphs = _project_graphs(db, project_id)
    if not graphs:
        return build_raci_matrix([])
    g = graphs[0]
    nodes = _parse_json_list(g.nodes_json)
    return build_raci_matrix(nodes, getattr(g, "owner_team", None))


@router.get("/graphs/{graph_id}/slo")
def graph_slo(graph_id: str, db: Session = Depends(get_db)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    nfr = _nfr_out(graph)
    nfr_dict = nfr.model_dump() if nfr else {}
    return {
        "services": compute_service_slos(nodes, nfr_dict),
        "error_budget": error_budget_burn_rate(nfr_dict),
    }


@router.post("/graphs/{graph_id}/benchmark")
def graph_benchmark(graph_id: str, db: Session = Depends(get_db), target_nodes: int = 500) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return run_graph_benchmark(nodes, edges, target_nodes=min(max(target_nodes, 50), 2000))


@router.post("/projects/{project_id}/adrs/export")
def export_adrs(project_id: str, payload: AdrPersistIn, db: Session = Depends(get_db)) -> dict:
    _project_graphs(db, project_id)
    if not payload.adrs:
        raise HTTPException(status_code=400, detail="Nenhum ADR informado")
    paths = persist_adrs_markdown(project_id, payload.adrs)
    return {"written": paths, "count": len(paths)}
