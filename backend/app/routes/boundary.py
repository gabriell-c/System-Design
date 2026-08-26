"""P2.2.2 — Contrato de borda entre subsystems.

Um contrato de borda define quais APIs/eventos atravessam a fronteira
entre dois subsystems (zones). Cada contrato é válido para um par
(source_zone, target_zone) e especifica o tipo de comunicação.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, GraphBoundaryContract, new_uuid
from app.models.user import User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/v1", tags=["boundary"])


@router.get("/graphs/{graph_id}/boundary-contracts")
def list_boundary_contracts(
    graph_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
):
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    rows = (
        db.execute(select(GraphBoundaryContract).where(GraphBoundaryContract.graph_id == graph_id))
        .scalars()
        .all()
    )
    return [
        {
            "id": r.id,
            "source_zone": r.source_zone,
            "target_zone": r.target_zone,
            "protocol": r.protocol,
            "description": r.description,
            "sla_ms": r.sla_ms,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/graphs/{graph_id}/boundary-contracts")
def create_boundary_contract(
    graph_id: str,
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
):
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    source = body.get("source_zone", "").strip()
    target = body.get("target_zone", "").strip()
    if not source or not target:
        raise HTTPException(status_code=422, detail="source_zone and target_zone required")
    db.add(GraphBoundaryContract(
        id=new_uuid(),
        graph_id=graph_id,
        source_zone=source,
        target_zone=target,
        protocol=body.get("protocol", "async"),
        description=body.get("description", ""),
        sla_ms=body.get("sla_ms"),
    ))
    db.commit()
    return {"ok": True}


@router.delete("/graphs/{graph_id}/boundary-contracts/{contract_id}")
def delete_boundary_contract(
    graph_id: str,
    contract_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
):
    row = db.get(GraphBoundaryContract, contract_id)
    if not row or row.graph_id != graph_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
