from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runner import analyze_architecture
from app.database import get_db, sqlite_write_guard
from app.models.graph import Graph, GraphVersion, new_uuid
from app.models.user import User
from app.rate_limit import rate_limit_analyze
from app.routes._graph_helpers import (
    _apply_etag,
    _nfr_out,
    _parse_json_list,
    _parse_json_obj,
    get_graph_or_404,
    get_project_or_404,
    graph_etag,
    to_out,
    viewable_graph_ids,
)
from app.routes.auth import get_current_user
from app.schemas.analysis import AnalysisResult, ComparisonResult
from app.schemas.graph import (
    AnalyzeRequest,
    CompareRequest,
    GraphOut,
    GraphPayload,
    GraphUpdate,
    GraphVersionOut,
    ProjectNfr,
    ReviewRequest,
)
from app.services.ai_settings import get_user_settings, require_llm_consent
from app.services.ai_usage import check_and_consume_analyze, record_llm_usage
from app.services.heuristic import analyze_graph, compare_analyses

router = APIRouter(prefix="/api/v1")

# Limites de entrada do pipeline de análise IA (P1.9a): grafos acima disso
# não são enviados ao LLM — a rota responde 413 explicando o teto.
MAX_ANALYZE_NODES = 400
MAX_ANALYZE_EDGES = 800
MAX_ANALYZE_CONTEXT_CHARS = 20_000


def analyze_input_error(nodes: list[dict], edges: list[dict], context: str) -> str | None:
    """Mensagem de erro quando a entrada excede os tetos de análise (ou None)."""
    if len(nodes) > MAX_ANALYZE_NODES:
        return (
            f"Graph too large for AI analysis: {len(nodes)} nodes (cap {MAX_ANALYZE_NODES}). "
            "Split the graph or remove detail nodes."
        )
    if len(edges) > MAX_ANALYZE_EDGES:
        return (
            f"Graph too large for AI analysis: {len(edges)} edges (cap {MAX_ANALYZE_EDGES}). "
            "Split the graph or remove detail nodes."
        )
    if len(context or "") > MAX_ANALYZE_CONTEXT_CHARS:
        return (
            f"Context too large for AI analysis: {len(context)} chars "
            f"(cap {MAX_ANALYZE_CONTEXT_CHARS}). Shorten the context text."
        )
    return None


def graph_fingerprint(nodes: list[dict], edges: list[dict], nfr_json: str) -> str:
    """SHA-256 de um snapshot normalizado (nodes+edges+nfr) — cache de LLM (P1.9b)."""
    def _norm_nodes(items: list[dict]) -> list[dict]:
        slim = [{"id": n.get("id"), "data": n.get("data") or {}} for n in items]
        slim.sort(key=lambda n: str(n.get("id")))
        return slim

    def _norm_edges(items: list[dict]) -> list[dict]:
        slim = [
            {k: e.get(k) for k in ("id", "source", "target", "data") if e.get(k) is not None}
            for e in items
        ]
        slim.sort(key=lambda e: json.dumps(e, sort_keys=True, default=str))
        return slim

    try:
        nfr = json.loads(nfr_json or "{}")
    except json.JSONDecodeError:
        nfr = {}
    blob = json.dumps(
        {"nodes": _norm_nodes(nodes), "edges": _norm_edges(edges), "nfr": nfr},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _snapshot(db: Session, graph: Graph) -> None:
    db.add(
        GraphVersion(
            id=new_uuid(),
            graph_id=graph.id,
            name=graph.name,
            nodes_json=graph.nodes_json,
            edges_json=graph.edges_json,
        )
    )


@router.get("/graphs", response_model=dict)
def list_graphs(
    limit: int = Query(default=50, ge=1, le=200, description="Máximo de resultados"),
    offset: int = Query(default=0, ge=0, description="Offset para paginação"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # P1.2 — IDOR: só grafos do dono, liberados por ACL, ou de projeto visível.
    visible_ids = viewable_graph_ids(db, current_user)
    base = select(Graph).where(Graph.id.in_(list(visible_ids) or ["__none__"])).order_by(Graph.updated_at.desc())

    # Count total for pagination metadata
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(base.subquery())
    total = db.scalar(count_stmt) or 0

    # Apply pagination
    rows = list(db.scalars(base.offset(offset).limit(limit)).all())
    return {
        "items": [to_out(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(rows) < total,
    }


@router.post("/graphs", response_model=GraphOut, status_code=201)
def create_graph(payload: GraphPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GraphOut:
    project_id = payload.project_id
    if project_id:
        # Só pode anexar o grafo a projeto do qual o usuário tem acesso.
        get_project_or_404(db, current_user, project_id)
    graph = Graph(
        id=new_uuid(),
        owner_id=current_user.id,
        project_id=project_id,
        owner_team=payload.owner_team,
        name=payload.name.strip(),
        context_text=(payload.context or "").strip(),
        nfr_json=(payload.nfr or ProjectNfr()).model_dump_json(),
        nodes_json=json.dumps(payload.nodes),
        edges_json=json.dumps(payload.edges),
        diagram_kind=payload.diagram_kind,
        parent_graph_id=payload.parent_graph_id,
        c4_parent_node_id=payload.c4_parent_node_id,
        # P1.13 — comentário fixado: persistir os elementos Excalidraw do editor
        excalidraw_elements_json=json.dumps(payload.excalidraw_elements or []),
        review_status="draft",
    )
    with sqlite_write_guard():
        db.add(graph)
        db.flush()
        _snapshot(db, graph)
        db.commit()
        db.refresh(graph)
    return to_out(graph)


@router.get("/graphs/{graph_id}", response_model=GraphOut)
def get_graph(
    graph_id: str,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GraphOut:
    graph = get_graph_or_404(db, current_user, graph_id)
    _apply_etag(response, graph)
    return to_out(graph)


@router.put("/graphs/{graph_id}", response_model=GraphOut)
def update_graph(
    graph_id: str,
    payload: GraphUpdate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> GraphOut:
    graph = get_graph_or_404(db, current_user, graph_id, write=True)
    current = graph_etag(graph)
    # Optimistic lock: when client sends If-Match, reject stale writes
    if if_match is not None and if_match.strip() and if_match.strip() != current:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "O diagrama foi alterado por outra sessão. Recarregue ou escolha a versão.",
                "server_etag": current,
                "updated_at": graph.updated_at.isoformat() if graph.updated_at else None,
            },
        )
    if payload.name is not None:
        graph.name = payload.name.strip()
    if payload.context is not None:
        graph.context_text = payload.context.strip()
    if payload.nfr is not None:
        graph.nfr_json = payload.nfr.model_dump_json()
    if payload.nodes is not None:
        graph.nodes_json = json.dumps(payload.nodes)
    if payload.edges is not None:
        graph.edges_json = json.dumps(payload.edges)
    # P1.7 — análise NÃO vem do cliente: analysis_json só é escrita pelo
    # pipeline /analyze (server-side). payload.analysis agora é ignorado.
    if payload.project_id is not None:
        if payload.project_id:
            get_project_or_404(db, current_user, payload.project_id, write=True)
        graph.project_id = payload.project_id
    if payload.owner_team is not None:
        graph.owner_team = payload.owner_team.strip() or None
    if payload.diagram_kind is not None:
        graph.diagram_kind = payload.diagram_kind
    if payload.parent_graph_id is not None:
        graph.parent_graph_id = payload.parent_graph_id
    if payload.c4_parent_node_id is not None:
        graph.c4_parent_node_id = payload.c4_parent_node_id
    if payload.excalidraw_elements is not None:
        graph.excalidraw_elements_json = json.dumps(payload.excalidraw_elements)
    graph.updated_at = datetime.now(UTC)
    with sqlite_write_guard():
        _snapshot(db, graph)
        db.commit()
        db.refresh(graph)
    _apply_etag(response, graph)
    return to_out(graph)


@router.delete("/graphs/{graph_id}", status_code=204)
def delete_graph(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    # P1.2 — remoção exige acesso de escrita; gráfico de terceiro → 404.
    graph = get_graph_or_404(db, current_user, graph_id, write=True)
    with sqlite_write_guard():
        db.delete(graph)
        db.commit()
    return Response(status_code=204)


@router.get("/graphs/{graph_id}/versions", response_model=list[GraphVersionOut])
def list_versions(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[GraphVersionOut]:
    graph = get_graph_or_404(db, current_user, graph_id)
    return [
        GraphVersionOut(
            id=version.id,
            graph_id=version.graph_id,
            name=version.name,
            nodes=_parse_json_list(version.nodes_json),
            edges=_parse_json_list(version.edges_json),
            created_at=version.created_at,
        )
        for version in graph.versions
    ]


@router.post("/graphs/{graph_id}/versions/{version_id}/restore", response_model=GraphOut)
def restore_version(graph_id: str, version_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GraphOut:
    graph = get_graph_or_404(db, current_user, graph_id, write=True)
    version = db.get(GraphVersion, version_id)
    if not version or version.graph_id != graph_id:
        raise HTTPException(status_code=404, detail="Versão não encontrada")
    graph.name = version.name
    graph.nodes_json = version.nodes_json
    graph.edges_json = version.edges_json
    graph.updated_at = datetime.now(UTC)
    with sqlite_write_guard():
        _snapshot(db, graph)
        db.commit()
        db.refresh(graph)
    return to_out(graph)


@router.get("/graphs/{graph_id}/diff/{version_id}")
def diff_graph_version(graph_id: str, version_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    from app.services.diff import semantic_diff

    graph = get_graph_or_404(db, current_user, graph_id)
    version = db.get(GraphVersion, version_id)
    if not version or version.graph_id != graph_id:
        raise HTTPException(status_code=404, detail="Versão não encontrada")
    return semantic_diff(
        _parse_json_list(version.nodes_json),
        _parse_json_list(version.edges_json),
        _parse_json_list(graph.nodes_json),
        _parse_json_list(graph.edges_json),
    )


@router.post("/graphs/{graph_id}/review", response_model=GraphOut)
def review_graph(graph_id: str, payload: ReviewRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GraphOut:
    graph = get_graph_or_404(db, current_user, graph_id, write=True)
    # P1.7 — o role do cliente é IGNORADO: a auto-approvação só ocorre quando
    # o usuário autenticado REALMENTE tem papel senior/admin.
    real_role = getattr(current_user, "role", None) or "other"
    if real_role in ("senior", "admin"):
        graph.review_status = "approved"
        graph.review_comment = payload.comment
        graph.reviewer_role = real_role
    else:
        graph.review_status = payload.status
        graph.review_comment = payload.comment
        graph.reviewer_role = "other"
    graph.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(graph)
    return to_out(graph)


# Item 30 — agentes_used leva "heuristic" quando só heurística local rodou;
# só agentes com relatório de LLM representam chamadas reais.
HEURISTIC_AGENT = "heuristic"


def _llm_calls_in_result(result: AnalysisResult) -> int:
    return sum(1 for agent in result.agents_used if agent != HEURISTIC_AGENT)


def _record_tokens(db: Session, user_id: int, result: AnalysisResult) -> None:
    """Item 27/28-be — registra as chamadas + tokens REAIS agregados pelo
    runner (result.usage é None-tolerante: 0 quando o provider não reportou)."""
    record_llm_usage(
        db,
        user_id,
        _llm_calls_in_result(result),
        tokens_in=result.usage.prompt_tokens if result.usage else 0,
        tokens_out=result.usage.completion_tokens if result.usage else 0,
    )


def _live_cache_hit(db: Session, payload: AnalyzeRequest) -> AnalysisResult | None:
    """Item 26 — endpoint vivo reusa o cache de fingerprint do grafo
    (mesmo snapshot → resposta SEM LLM e SEM consumo de orçamento).

    Só se aplica quando o request traz persist_id (espelha a expressão de
    fingerprint da rota salva; nfr do payload tem prioridade, igual ao
    bloco de persistência). Cache hit é devolvido com `cached: True`.
    """
    if not payload.persist_id:
        return None
    graph = db.get(Graph, payload.persist_id)
    if graph is None:
        return None
    nfr_json = payload.nfr.model_dump_json() if payload.nfr is not None else (graph.nfr_json or "{}")
    fp = graph_fingerprint(payload.nodes, payload.edges, nfr_json)
    if graph.analysis_fingerprint != fp or not graph.analysis_json:
        return None
    cached = _parse_json_obj(graph.analysis_json)
    if not cached:
        return None
    return AnalysisResult.model_validate(cached).model_copy(update={"cached": True})


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_live(
    payload: AnalyzeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    rate_limit_analyze(request, current_user.email or str(current_user.id))
    # P1.9a — teto de entrada: não enviamos grafos acima do limite ao LLM.
    oversize = analyze_input_error(payload.nodes, payload.edges, payload.context or "")
    if oversize:
        raise HTTPException(status_code=413, detail=oversize)
    # Item 37 — DLP: provedor externo exige consentimento explícito (403).
    # O gate fica ANTES do cache (item 26): cache hit não dispensa consentimento.
    user_settings = get_user_settings(db, current_user)
    require_llm_consent(db, current_user, user_settings)
    # Item 26 — cache de fingerprint lido ANTES de consumir orçamento/LLM:
    # snapshot idêntico devolve o resultado salvo com `cached: True`, sem LLM.
    cached = _live_cache_hit(db, payload)
    if cached is not None:
        return cached
    # P1.9c / item 30 — orçamento diário durável em SQLite (429 ao exceder).
    # Consumido SOMENTE quando realmente vai chamar o LLM.
    check_and_consume_analyze(db, current_user.id)
    nfr_dict = payload.nfr.model_dump() if payload.nfr else None
    # Item 28-be — LLM com o runtime escopado do usuário atual.
    result = await analyze_architecture(
        payload.nodes,
        payload.edges,
        context=payload.context or "",
        nfr=nfr_dict,
        db=db,
        user=current_user,
    )
    _record_tokens(db, current_user.id, result)
    if payload.persist_id:
        graph = db.get(Graph, payload.persist_id)
        if graph:
            graph.analysis_json = result.model_dump_json()
            if payload.context is not None:
                graph.context_text = payload.context.strip()
            if payload.nfr is not None:
                graph.nfr_json = payload.nfr.model_dump_json()
            # P1.9b — registra a fingerprint do snapshot analisado para o cache.
            graph.analysis_fingerprint = graph_fingerprint(
                payload.nodes, payload.edges, graph.nfr_json or "{}"
            )
            graph.review_status = "analyzed" if graph.review_status == "draft" else graph.review_status
            graph.updated_at = datetime.now(UTC)
            db.commit()
    return result


@router.post("/graphs/{graph_id}/analyze", response_model=AnalysisResult)
async def analyze_saved(
    graph_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    rate_limit_analyze(request, current_user.email or str(current_user.id))
    # Item 37 — DLP: provedor externo exige consentimento explícito (403),
    # inclusive em cache hit (gate no topo do endpoint, conforme spec).
    user_settings = get_user_settings(db, current_user)
    require_llm_consent(db, current_user, user_settings)
    graph = get_graph_or_404(db, current_user, graph_id, write=True)
    nodes = _parse_json_list(graph.nodes_json)
    edges = _parse_json_list(graph.edges_json)
    context = getattr(graph, "context_text", None) or ""
    # P1.9a — teto de entrada.
    oversize = analyze_input_error(nodes, edges, context)
    if oversize:
        raise HTTPException(status_code=413, detail=oversize)

    # P1.9b — cache: se o snapshot não mudou desde a última análise, reutiliza
    # (item 26: cache hit é gratuito — SEM LLM, SEM orçamento, `cached: True`).
    fp = graph_fingerprint(nodes, edges, graph.nfr_json or "{}")
    if graph.analysis_fingerprint == fp and graph.analysis_json:
        cached = _parse_json_obj(graph.analysis_json)
        if cached:
            return AnalysisResult.model_validate(cached).model_copy(update={"cached": True})

    # P1.9c / item 30 — orçamento diário (durável em SQLite; consumido só
    # quando realmente chamamos o LLM — cache hit é gratuito).
    check_and_consume_analyze(db, current_user.id)
    nfr = _nfr_out(graph)
    # Item 28-be — LLM com o runtime escopado do usuário atual.
    result = await analyze_architecture(
        nodes,
        edges,
        context=context,
        nfr=nfr.model_dump() if nfr else None,
        db=db,
        user=current_user,
    )
    _record_tokens(db, current_user.id, result)
    graph.analysis_json = result.model_dump_json()
    graph.analysis_fingerprint = fp
    graph.review_status = "analyzed" if graph.review_status == "draft" else graph.review_status
    graph.updated_at = datetime.now(UTC)
    db.commit()
    return result


@router.post("/compare", response_model=ComparisonResult)
async def compare(
    payload: CompareRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> ComparisonResult:
    rate_limit_analyze(request, current_user.email or str(current_user.id))
    left = await analyze_architecture(
        payload.left.nodes,
        payload.left.edges,
        context=payload.left.context or "",
        nfr=payload.left.nfr.model_dump() if payload.left.nfr else None,
    )
    right = await analyze_architecture(
        payload.right.nodes,
        payload.right.edges,
        context=payload.right.context or "",
        nfr=payload.right.nfr.model_dump() if payload.right.nfr else None,
    )
    return ComparisonResult(left=left, right=right, comparison=compare_analyses(left, right))


@router.post("/analyze/heuristic", response_model=AnalysisResult)
def analyze_heuristic_only(
    payload: GraphPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    """Atalho determinístico para testes sem OmniRoute."""
    rate_limit_analyze(request, current_user.email or str(current_user.id))
    return analyze_graph(payload.nodes, payload.edges)

