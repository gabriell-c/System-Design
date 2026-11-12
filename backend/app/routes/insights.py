"""P1 routes — polyglot map, lineage, simulation scenarios, capacity.

P1.13 — módulo renomeado de p1.py; checagens de ownership (P1.2) via helpers
compartilhados em app.routes._graph_helpers.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import SimulationScenario, new_uuid
from app.models.user import User
from app.routes._graph_helpers import _nfr_out, _parse_json_list, get_graph_or_404
from app.routes.auth import get_current_user
from app.schemas.simulation import (
    SimulationRequest,
    SimulationResult,
    SimulationScenarioPayload,
)
from app.services.capacity import estimate_capacity
from app.services.lineage import build_lineage
from app.services.polyglot_map import build_polyglot_map
from app.services.simulation import list_presets, run_simulation

router = APIRouter(prefix="/api/v1", tags=["p1"])


class SimulationScenarioCreate(BaseModel):
    """Criação de cenário de simulação (item 8).

    `name`: teto 200 (DB é String(200) — sem o teto era 500 de
    IntegrityError com nome grande). `payload`: tipado (SimulationScenarioPayload)
    mas permissivo — payloads antigos free-form continuam válidos
    (chaves desconhecidas são mantidas; chaves conhecidas são validadas).
    """

    name: str = Field(max_length=200)
    payload: SimulationScenarioPayload = Field(default_factory=SimulationScenarioPayload)


class SimulationScenarioOut(BaseModel):
    id: str
    graph_id: str
    name: str
    payload: dict
    created_at: str
    updated_at: str


@router.get("/graphs/{graph_id}/polyglot-map")
def polyglot_map(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    return build_polyglot_map(nodes, edges)


@router.get("/graphs/{graph_id}/lineage")
def lineage(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    nfr = _nfr_out(graph)
    return build_lineage(nodes, edges, nfr.model_dump() if nfr else None)


@router.get("/graphs/{graph_id}/capacity-estimate")
def capacity_estimate(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    graph = get_graph_or_404(db, current_user, graph_id)
    nodes = _parse_json_list(graph.nodes_json)
    nfr = _nfr_out(graph)
    return estimate_capacity(nodes, nfr.model_dump() if nfr else None)


@router.get("/graphs/{graph_id}/simulation-scenarios", response_model=list[SimulationScenarioOut])
def list_scenarios(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[SimulationScenarioOut]:
    get_graph_or_404(db, current_user, graph_id)
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
    # P1.2 — escrita exige acesso de escrita no grafo.
    get_graph_or_404(db, current_user, graph_id, write=True)
    row = SimulationScenario(
        id=new_uuid(),
        graph_id=graph_id,
        name=payload.name.strip() or "Cenário",
        # Payload tipado → serializa o model (inclui chaves extra mantidas
        # por compatibilidade com payload legado free-form).
        payload_json=json.dumps(payload.payload.model_dump(), ensure_ascii=False, default=str),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _scenario_out(row)


@router.delete("/graphs/{graph_id}/simulation-scenarios/{scenario_id}")
def delete_scenario(graph_id: str, scenario_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    # P1.2 — remoção exige acesso de escrita no grafo.
    get_graph_or_404(db, current_user, graph_id, write=True)
    row = (
        db.query(SimulationScenario)
        .filter(SimulationScenario.id == scenario_id, SimulationScenario.graph_id == graph_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Cenário não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post(
    "/graphs/{graph_id}/simulation-scenarios/{scenario_id}/run",
    response_model=SimulationResult,
)
def run_scenario(
    graph_id: str,
    scenario_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationResult:
    """Roda um cenário salvo contra os nodes/edges ATUAIS do grafo (item 8).

    Rulings (custo-se-errado documentado):
    - Execução é READ no grafo (write=False): cenário + grafo são só
      entrada do engine; quem só tem acesso de leitura já pode "ver o
      resultado" dos dados que consegue ler.
    - `preset_id` no payload resolve via `list_presets()` (load/journey/
      events do catálogo; campos do payload sobrepõem parâmetros de
      execução); sem `preset_id` → request direto dos campos do payload.
    - Endpoint devolve SEMPRE SimulationResult (JSON); se o payload pede
      `output_format` csv/prometheus, o engine preenche `export_body`
      dentro do resultado (o front extrai dali) — ruling mais simples que
      um endpoint de export separado.
    """
    graph = get_graph_or_404(db, current_user, graph_id)
    row = (
        db.query(SimulationScenario)
        .filter(SimulationScenario.id == scenario_id, SimulationScenario.graph_id == graph_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Cenário não encontrado")
    try:
        data = json.loads(row.payload_json or "{}")
    except json.JSONDecodeError:
        data = {}
    try:
        payload = SimulationScenarioPayload.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Payload do cenário inválido: {exc.errors()}",
        ) from exc

    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)

    preset = None
    if payload.preset_id:
        preset = next((p for p in list_presets() if p.id == payload.preset_id), None)
        if preset is None:
            raise HTTPException(status_code=404, detail=f"Preset não encontrado: {payload.preset_id}")

    req = SimulationRequest(
        name=payload.name or row.name,
        context=payload.context,
        nodes=nodes,
        edges=edges,
        seed=payload.seed,
        realism_level=payload.realism_level,
        test_mode=payload.test_mode,
        load=preset.load if preset else payload.load,
        journey=preset.journey if preset else payload.journey,
        events=list(preset.events) if preset else payload.events,
        validation_rules=payload.validation_rules,
        output_format=payload.output_format,
        include_timeline=payload.include_timeline,
    )
    result = run_simulation(req)
    if preset:
        result.presets_used = [preset.id]
    return result


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
