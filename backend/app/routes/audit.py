"""P1.4.4 — Audit trail endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import AuditEntry, Graph
from app.routes.auth import get_current_user
from app.services.audit import AuditLogService
from typing import List

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/{graph_id}")
def list_audit_entries(
    graph_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Get audit entries for a graph."""
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    service = AuditLogService(db)
    entries = service.get_entries(graph_id, limit=limit, offset=offset)

    return [
        {
            "id": e.id,
            "graph_id": e.graph_id,
            "user_email": e.user_email,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "previous_state": e.previous_state,
            "new_state": e.new_state,
            "ip_address": e.ip_address,
            "user_agent": e.user_agent,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.get("/{graph_id}/count")
def count_audit_entries(
    graph_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get total count of audit entries for a graph."""
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    service = AuditLogService(db)
    count = service.get_entries_count(graph_id)
    return {"count": count}