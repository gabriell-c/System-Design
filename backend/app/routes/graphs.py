from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.agents.runner import analyze_architecture
from app.database import get_db
from app.models.graph import Graph, GraphVersion
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
        created_at=graph.created_at,
        updated_at=graph.updated_at,
    )


def _snapshot(db: Session, graph: Graph) -> None:
    db.add(
        GraphVersion(
            graph_id=graph.id,
            name=graph.name,
            nodes_json=graph.nodes_json,
            edges_json=graph.edges_json,
        )
    )


@router.get("/graphs", response_model=list[GraphOut])
def list_graphs(db: Session = Depends(get_db)) -> list[GraphOut]:
    rows = db.query(Graph).order_by(Graph.updated_at.desc()).all()
    return [to_out(row) for row in rows]


@router.post("/graphs", response_model=GraphOut, status_code=201)
def create_graph(payload: GraphPayload, db: Session = Depends(get_db)) -> GraphOut:
    graph = Graph(
        name=payload.name.strip(),
        context_text=(payload.context or "").strip(),
        nfr_json=(payload.nfr or ProjectNfr()).model_dump_json(),
        nodes_json=json.dumps(payload.nodes),
        edges_json=json.dumps(payload.edges),
        review_status="draft",
    )
    db.add(graph)
    db.flush()
    _snapshot(db, graph)
    db.commit()
    db.refresh(graph)
    return to_out(graph)


@router.get("/graphs/{graph_id}", response_model=GraphOut)
def get_graph(graph_id: str, db: Session = Depends(get_db)) -> GraphOut:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    return to_out(graph)


@router.put("/graphs/{graph_id}", response_model=GraphOut)
def update_graph(graph_id: str, payload: GraphUpdate, db: Session = Depends(get_db)) -> GraphOut:
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
    graph.updated_at = datetime.now(timezone.utc)
    _snapshot(db, graph)
    db.commit()
    db.refresh(graph)
    return to_out(graph)


@router.delete("/graphs/{graph_id}", status_code=204)
def delete_graph(graph_id: str, db: Session = Depends(get_db)) -> Response:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    db.delete(graph)
    db.commit()
    return Response(status_code=204)


@router.get("/graphs/{graph_id}/versions", response_model=list[GraphVersionOut])
def list_versions(graph_id: str, db: Session = Depends(get_db)) -> list[GraphVersionOut]:
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
def restore_version(graph_id: str, version_id: str, db: Session = Depends(get_db)) -> GraphOut:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Grafo não encontrado")
    version = db.get(GraphVersion, version_id)
    if not version or version.graph_id != graph_id:
        raise HTTPException(status_code=404, detail="Versão não encontrada")
    graph.name = version.name
    graph.nodes_json = version.nodes_json
    graph.edges_json = version.edges_json
    graph.updated_at = datetime.now(timezone.utc)
    _snapshot(db, graph)
    db.commit()
    db.refresh(graph)
    return to_out(graph)


@router.post("/graphs/{graph_id}/review", response_model=GraphOut)
def review_graph(graph_id: str, payload: ReviewRequest, db: Session = Depends(get_db)) -> GraphOut:
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
    graph.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(graph)
    return to_out(graph)


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_live(payload: AnalyzeRequest, db: Session = Depends(get_db)) -> AnalysisResult:
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
            graph.updated_at = datetime.now(timezone.utc)
            db.commit()
    return result


@router.post("/graphs/{graph_id}/analyze", response_model=AnalysisResult)
async def analyze_saved(graph_id: str, db: Session = Depends(get_db)) -> AnalysisResult:
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
    graph.updated_at = datetime.now(timezone.utc)
    db.commit()
    return result


@router.post("/compare", response_model=ComparisonResult)
async def compare(payload: CompareRequest) -> ComparisonResult:
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
def analyze_heuristic_only(payload: GraphPayload) -> AnalysisResult:
    """Atalho determinístico para testes sem OmniRoute."""
    return analyze_graph(payload.nodes, payload.edges)
