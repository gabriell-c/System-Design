from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runner import analyze_architecture
from app.database import get_db, sqlite_write_guard
from app.models.graph import Graph, GraphVersion, new_uuid
from app.models.user import User
from app.rate_limit import rate_limit_analyze
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
from app.services.heuristic import analyze_graph, compare_analyses

router = APIRouter(prefix="/api/v1")


def _parse_json_list(raw: str) -> list:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Grafo corrompido no banco") from exc
    return data if isinstance(data, list) else []


def _parse_json_obj(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _nfr_out(graph: Graph) -> ProjectNfr | None:
    raw = getattr(graph, "nfr_json", None) or "{}"
    data = _parse_json_obj(raw)
    if not data:
        return ProjectNfr()
    try:
        return ProjectNfr.model_validate(data)
    except Exception:  # noqa: BLE001 — fallback to defaults on malformed NFR data
        return ProjectNfr()


def to_out(graph: Graph) -> GraphOut:
    return GraphOut(
        id=graph.id,
        name=graph.name,
        context=getattr(graph, "context_text", None) or "",
        nfr=_nfr_out(graph),
        nodes=_parse_json_list(graph.nodes_json),
        edges=_parse_json_list(graph.edges_json),
        analysis=_parse_json_obj(graph.analysis_json),
        review_status=graph.review_status,
        review_comment=graph.review_comment,
        reviewer_role=graph.reviewer_role,
        project_id=getattr(graph, "project_id", None),
        owner_team=getattr(graph, "owner_team", None),
        diagram_kind=getattr(graph, "diagram_kind", None),
        parent_graph_id=getattr(graph, "parent_graph_id", None),
        c4_parent_node_id=getattr(graph, "c4_parent_node_id", None),
        created_at=graph.created_at,
        updated_at=graph.updated_at,
    )


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
    stmt = select(Graph).order_by(Graph.updated_at.desc())

    # Count total for pagination metadata
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.scalar(count_stmt) or 0

    # Apply pagination
    rows = list(db.scalars(stmt.offset(offset).limit(limit)).all())
    return {
        "items": [to_out(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(rows) < total,
    }


@router.post("/graphs", response_model=GraphOut, status_code=201)
def create_graph(payload: GraphPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GraphOut:
    graph = Graph(
        id=new_uuid(),
        project_id=payload.project_id,
        owner_team=payload.owner_team,
        name=payload.name.strip(),
        context_text=(payload.context or "").strip(),
        nfr_json=(payload.nfr or ProjectNfr()).model_dump_json(),
        nodes_json=json.dumps(payload.nodes),
        edges_json=json.dumps(payload.edges),
        diagram_kind=payload.diagram_kind,
        parent_graph_id=payload.parent_graph_id,
        c4_parent_node_id=payload.c4_parent_node_id,
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
def get_graph(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GraphOut:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    return to_out(graph)


@router.put("/graphs/{graph_id}", response_model=GraphOut)
def update_graph(graph_id: str, payload: GraphUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GraphOut:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
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
    if payload.analysis is not None:
        graph.analysis_json = json.dumps(payload.analysis)
    if payload.project_id is not None:
        graph.project_id = payload.project_id
    if payload.owner_team is not None:
        graph.owner_team = payload.owner_team.strip() or None
    if payload.diagram_kind is not None:
        graph.diagram_kind = payload.diagram_kind
    if payload.parent_graph_id is not None:
        graph.parent_graph_id = payload.parent_graph_id
    if payload.c4_parent_node_id is not None:
        graph.c4_parent_node_id = payload.c4_parent_node_id
    graph.updated_at = datetime.now(UTC)
    with sqlite_write_guard():
        _snapshot(db, graph)
        db.commit()
        db.refresh(graph)
    return to_out(graph)


@router.delete("/graphs/{graph_id}", status_code=204)
def delete_graph(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    with sqlite_write_guard():
        db.delete(graph)
        db.commit()
    return Response(status_code=204)


@router.get("/graphs/{graph_id}/versions", response_model=list[GraphVersionOut])
def list_versions(graph_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[GraphVersionOut]:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
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
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
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

    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
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
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    if payload.role == "senior":
        graph.review_status = "approved"
        graph.review_comment = payload.comment
        graph.reviewer_role = "senior"
    else:
        graph.review_status = payload.status
        graph.review_comment = payload.comment
        graph.reviewer_role = "other"
    graph.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(graph)
    return to_out(graph)


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_live(
    payload: AnalyzeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    rate_limit_analyze(request, current_user.email or str(current_user.id))
    nfr_dict = payload.nfr.model_dump() if payload.nfr else None
    result = await analyze_architecture(
        payload.nodes,
        payload.edges,
        context=payload.context or "",
        nfr=nfr_dict,
    )
    if payload.persist_id:
        graph = db.get(Graph, payload.persist_id)
        if graph:
            graph.analysis_json = result.model_dump_json()
            if payload.context is not None:
                graph.context_text = payload.context.strip()
            if payload.nfr is not None:
                graph.nfr_json = payload.nfr.model_dump_json()
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
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    nfr = _nfr_out(graph)
    result = await analyze_architecture(
        _parse_json_list(graph.nodes_json),
        _parse_json_list(graph.edges_json),
        context=getattr(graph, "context_text", None) or "",
        nfr=nfr.model_dump() if nfr else None,
    )
    graph.analysis_json = result.model_dump_json()
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
