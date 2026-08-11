from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.schemas.simulation import SimulationPreset, SimulationRequest, SimulationResult
from app.services.simulation import (
    build_request_from_preset,
    get_preset,
    list_presets,
    run_simulation,
)

router = APIRouter(prefix="/api/v1/simulations", tags=["simulations"])


class PresetRunRequest(BaseModel):
    preset_id: str
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    context: str = ""
    seed: int = Field(default=42, ge=0)
    realism_level: float = Field(default=0.65, ge=0.0, le=1.0)
    output_format: str = "json"


@router.get("/presets", response_model=list[SimulationPreset])
def presets() -> list[SimulationPreset]:
    return list_presets()


@router.get("/presets/{preset_id}", response_model=SimulationPreset)
def preset_detail(preset_id: str) -> SimulationPreset:
    preset = get_preset(preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset não encontrado")
    return preset


@router.post("/run", response_model=SimulationResult)
def run(payload: SimulationRequest) -> SimulationResult | Response:
    if not payload.nodes:
        raise HTTPException(status_code=400, detail="Grafo vazio — adicione nodes antes de simular")
    result = run_simulation(payload)
    if payload.output_format in {"csv", "prometheus"} and result.export_body is not None:
        return Response(
            content=result.export_body,
            media_type=result.export_content_type or "text/plain",
            headers={"X-Archia-Seed": str(result.seed), "X-Archia-Realism": str(result.realism_score)},
        )
    return result


@router.post("/run-preset", response_model=SimulationResult)
def run_preset(payload: PresetRunRequest) -> SimulationResult | Response:
    if not payload.nodes:
        raise HTTPException(status_code=400, detail="Grafo vazio — adicione nodes antes de simular")
    try:
        req = build_request_from_preset(
            payload.preset_id,
            payload.nodes,
            payload.edges,
            seed=payload.seed,
            realism_level=payload.realism_level,
            context=payload.context,
            output_format=payload.output_format,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = run_simulation(req)
    result.presets_used = [payload.preset_id]
    if payload.output_format in {"csv", "prometheus"} and result.export_body is not None:
        return Response(
            content=result.export_body,
            media_type=result.export_content_type or "text/plain",
            headers={"X-Archia-Seed": str(result.seed), "X-Archia-Realism": str(result.realism_score)},
        )
    return result
