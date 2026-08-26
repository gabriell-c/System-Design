"""P1 routes — polyglot map, lineage, simulation scenarios, capacity."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, SimulationScenario, new_uuid
from app.models.user import User
from app.routes.auth import get_current_user
from app.routes.graphs import _nfr_out, _parse_json_list
from app.services.capacity import estimate_capacity
from app.services.lineage import build_lineage
from app.services.polyglot_map import build_polyglot_map

router = APIRouter(prefix="/api/v1", tags=["p1"])


class SimulationScenarioCreate(BaseModel):
    name: str
    payload: dict = Field(default_factory=dict)


class SimulationScenarioOut(BaseModel):
    id: str
    graph_id: str
    name: str
    payload: dict
    created_at: str
    updated_at: str


@router.get("/graphs/{graph_id}/polyglot-map")
def polyglot_map(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return build_polyglot_map(nodes, edges)


@router.get("/graphs/{graph_id}/lineage")
def lineage(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    nfr = _nfr_out(graph)
    return build_lineage(nodes, edges, nfr.model_dump() if nfr else None)


@router.get("/graphs/{graph_id}/capacity-estimate")
def capacity_estimate(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    nodes = _parse_json_list(graph.nodes_json)
    nfr = _nfr_out(graph)
    return estimate_capacity(nodes, nfr.model_dump() if nfr else None)


@router.get("/graphs/{graph_id}/simulation-scenarios", response_model=list[SimulationScenarioOut])
def list_scenarios(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[SimulationScenarioOut]:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    rows = (
        db.query(SimulationScenario)
        .filter(SimulationScenario.graph_id == graph_id)
        .order_by(SimulationScenario.updated_at.desc())
        .all()
    )
    return [_scenario_out(r) for r in rows]


@router.post("/graphs/{graph_id}/simulation-scenarios", response_model=SimulationScenarioOut)
def create_scenario(
    graph_id: str, payload: SimulationScenarioCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> SimulationScenarioOut:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    row = SimulationScenario(
        id=new_uuid(),
        graph_id=graph_id,
        name=payload.name.strip() or "Cenário",
        payload_json=json.dumps(payload.payload, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _scenario_out(row)


@router.delete("/graphs/{graph_id}/simulation-scenarios/{scenario_id}")
def delete_scenario(graph_id: str, scenario_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    row = (
        db.query(SimulationScenario)
        .filter(SimulationScenario.id == scenario_id, SimulationScenario.graph_id == graph_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _scenario_out(row: SimulationScenario) -> SimulationScenarioOut:
    try:
        payload = json.loads(row.payload_json or "{}")
    except json.JSONDecodeError:
        payload = {}
    return SimulationScenarioOut(
        id=row.id,
        graph_id=row.graph_id,
        name=row.name,
        payload=payload,
        created_at=row.created_at.isoformat() if row.created_at else "",
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
    )
