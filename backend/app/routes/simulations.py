"""P0.5 — Simulações: presets, execução inline e exportação.

Ruling (item 18, contrato c): superfície dupla INTENCIONAL por enquanto —
- `/simulations/*` (aqui): grafo inline no payload, para grafos NÃO salvos
  ou one-shots; sem ownership (nada a proteger — o grafo não é recurso do
  usuário, é payload).
- `/graphs/{id}/simulation-scenarios/*` (routes/insights.py): grafos em
  banco com ownership; o endpoint `.../run` é a PONTE entre as duas
  superfícies (cenário salvo roda contra os nodes/edges atuais do grafo).
Versionar em v2 / reorganizar prefixos é issue FUTURA — não mover agora.

Contratos (b) com o engine S1a, documentados no schema:
- `SimulationRequest.context` afeta audit/summary;
- `reproducible` é calculado pelo service;
- `SimulationResult.events.max_cascade_fanout` (renomeado de cascade_depth);
- `build_request_from_preset` aceita Literais e levanta
  ValidationError/ValueError em valor inválido → esta rota converte em 422.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ValidationError

from app.models.user import User
from app.rate_limit import rate_limit_simulation, user_rate_limit_key
from app.routes.auth import get_current_user
from app.schemas.simulation import (
    OutputFormat,
    SimulationPreset,
    SimulationRequest,
    SimulationResult,
)
from app.services.simulation import (
    build_request_from_preset,
    get_preset,
    list_presets,
    run_simulation,
)

router = APIRouter(prefix="/api/v1/simulations", tags=["simulations"])

# Teto do grafo inline em simulação (item 2; espelha MAX_ANALYZE_* do
# /analyze em routes/graphs.py): acima disso o worker síncrono trava —
# responde 413 explicando o teto em vez de OOM/timeout.
MAX_SIMULATION_NODES = 400
MAX_SIMULATION_EDGES = 800

CSV_MEDIA_TYPE = "text/csv"
PROMETHEUS_MEDIA_TYPE = "text/plain"

# Cache de presets estáticos (item 16): catálogo em módulo, sem custo de
# recomputar — 5 min no cliente.
PRESETS_CACHE_MAX_AGE_S = 300


class PresetRunRequest(SimulationRequest):
    """Roda um preset contra um grafo inline (item 17).

    Subclasse de `SimulationRequest` — zero duplicação de campos:
    `test_mode`/`output_format` já são os Literais (422 em "banana" aqui,
    igual ao /run) e `validation_rules` usa a mesma whitelist de métricas.
    O campo novo é só `preset_id`.
    """

    preset_id: str


def _oversize_detail(nodes: list[dict], edges: list[dict]) -> str | None:
    """Detalhe pt-BR do 413 quando o grafo inline passa dos tetos (item 2)."""
    if len(nodes) > MAX_SIMULATION_NODES:
        return (
            f"Grafo grande demais para simulação: {len(nodes)} nós "
            f"(teto {MAX_SIMULATION_NODES}). Divida o grafo ou remova nós de detalhe."
        )
    if len(edges) > MAX_SIMULATION_EDGES:
        return (
            f"Grafo grande demais para simulação: {len(edges)} arestas "
            f"(teto {MAX_SIMULATION_EDGES}). Divida o grafo ou remova arestas de detalhe."
        )
    return None


def _export_response(
    result: SimulationResult, export_body: str | None, output_format: OutputFormat
) -> SimulationResult | Response:
    """Helper de exportação (item 13) — única implementação p/ /run e /run-preset.

    Ruling: um endpoint só (não /export separado — o front já controla
    `output_format` e o formato é declarativo, não uma nova operação).
    - json → SimulationResult (response_model None + `responses` documenta).
    - csv/prometheus → corpo de arquivo com Content-Type fixo por formato e
      Content-Disposition attachment; filename `sim-{seed}-{mode}.{csv|prom}`.
      (Ruling: extensão do arquivo segue o formato, não é .csv nos dois.)
    - export_body None em csv/prometheus → 400 explícito (antes: JSON
      silencioso).
    """
    if output_format == "json":
        return result
    if export_body is None:
        raise HTTPException(
            status_code=400,
            detail=f"Simulação terminou sem conteúdo para exportar no formato '{output_format}'",
        )
    ext = "csv" if output_format == "csv" else "prom"
    media_type = CSV_MEDIA_TYPE if output_format == "csv" else PROMETHEUS_MEDIA_TYPE
    return Response(
        content=export_body,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="sim-{result.seed}-{result.test_mode}.{ext}"',
            "X-Archia-Seed": str(result.seed),
            "X-Archia-Realism": str(result.realism_score),
        },
    )


# Documentação OpenAPI dos formatos alternativos (item 13): response_model
# None + respostas por Content-Type, já que o mesmo endpoint devolve JSON ou
# texto conforme `output_format`.
_ALTERNATE_FORMAT_RESPONSES = {
    "200": {
        "description": (
            "SimulationResult em JSON quando output_format='json'; "
            "texto CSV (text/csv) ou Prometheus (text/plain) com "
            "Content-Disposition attachment nos demais formatos."
        ),
        "content": {
            "text/csv": {"schema": {"type": "string"}},
            "text/plain": {"schema": {"type": "string"}},
        },
    }
}


@router.get("/presets", response_model=list[SimulationPreset])
def presets(
    current_user: User = Depends(get_current_user),
    response: Response = Response(),
) -> list[SimulationPreset]:
    # Itens 15/16: presets são estáticos — Cache-Control 5min; devolve
    # CÓPIAS (model_copy) para não expor o catálogo global mutável
    # (services.simulation.PRESETS) para mutação via response cache.
    response.headers["Cache-Control"] = f"max-age={PRESETS_CACHE_MAX_AGE_S}"
    return [p.model_copy() for p in list_presets()]


@router.get("/presets/{preset_id}", response_model=SimulationPreset)
def preset_detail(
    preset_id: str,
    current_user: User = Depends(get_current_user),
    response: Response = Response(),
) -> SimulationPreset:
    preset = get_preset(preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset não encontrado")
    # Mesma proteção de mutabilidade do GET /presets (item 16).
    response.headers["Cache-Control"] = f"max-age={PRESETS_CACHE_MAX_AGE_S}"
    return preset.model_copy()


@router.post("/run", response_model=None, responses=_ALTERNATE_FORMAT_RESPONSES)
def run(
    payload: SimulationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SimulationResult | Response:
    rate_limit_simulation(request, user_rate_limit_key(current_user))
    oversize = _oversize_detail(payload.nodes, payload.edges)
    if oversize:
        raise HTTPException(status_code=413, detail=oversize)
    if not payload.nodes:
        raise HTTPException(status_code=400, detail="Grafo vazio — adicione nodes antes de simular")
    result = run_simulation(payload)
    return _export_response(result, result.export_body, payload.output_format)


@router.post("/run-preset", response_model=None, responses=_ALTERNATE_FORMAT_RESPONSES)
def run_preset(
    payload: PresetRunRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SimulationResult | Response:
    rate_limit_simulation(request, user_rate_limit_key(current_user))
    oversize = _oversize_detail(payload.nodes, payload.edges)
    if oversize:
        raise HTTPException(status_code=413, detail=oversize)
    if not payload.nodes:
        raise HTTPException(status_code=400, detail="Grafo vazio — adicione nodes antes de simular")
    # Preset inexistente é 404 (recurso não encontrado), não 422.
    if get_preset(payload.preset_id) is None:
        raise HTTPException(status_code=404, detail=f"Preset não encontrado: {payload.preset_id}")
    try:
        req = build_request_from_preset(
            preset_id=payload.preset_id,
            nodes=payload.nodes,
            edges=payload.edges,
            seed=payload.seed,
            realism_level=payload.realism_level,
            context=payload.context,
            output_format=payload.output_format,
            test_mode=payload.test_mode,
        )
    except (ValidationError, ValueError) as exc:
        # Literais já validados no PresetRunRequest (422 automático); isto
        # cobre o service levantar ValidationError/ValueError a nível de
        # parâmetro (contrato b) — 422, nunca 500.
        raise HTTPException(status_code=422, detail=f"Parâmetros de simulação inválidos: {exc}") from exc
    result = run_simulation(req)
    result.presets_used = [payload.preset_id]
    return _export_response(result, result.export_body, payload.output_format)
