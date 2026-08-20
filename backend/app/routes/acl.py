"""P2.2.3 — ACL por squad/owner_team em grafos."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, GraphAccess, new_uuid
from app.schemas.graph import TeamAccess

router = APIRouter(prefix="/api/v1", tags=["acl"])


@router.get("/graphs/{graph_id}/access")
def list_graph_access(graph_id: str, db: Annotated[Session, Depends(get_db)]):
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    rows = db.execute(select(GraphAccess).where(GraphAccess.graph_id == graph_id)).scalars().all()
    return [TeamAccess(team=r.team, role=r.role) for r in rows]


@router.post("/graphs/{graph_id}/access")
def add_graph_access(
    graph_id: str,
    access: TeamAccess,
    db: Annotated[Session, Depends(get_db)],
):
    if access.role not in ("read", "write", "admin"):
        raise HTTPException(status_code=422, detail="role must be read/write/admin")
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    existing = (
        db.execute(select(GraphAccess).where(GraphAccess.graph_id == graph_id, GraphAccess.team == access.team))
        .scalars()
        .first()
    )
    if existing:
        existing.role = access.role
        db.commit()
        return TeamAccess(team=existing.team, role=existing.role)
    db.add(GraphAccess(id=new_uuid(), graph_id=graph_id, team=access.team, role=access.role))
    db.commit()
    return TeamAccess(team=access.team, role=access.role)


@router.delete("/graphs/{graph_id}/access/{team}")
def delete_graph_access(graph_id: str, team: str, db: Annotated[Session, Depends(get_db)]):
    row = (
        db.execute(select(GraphAccess).where(GraphAccess.graph_id == graph_id, GraphAccess.team == team))
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Access rule not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
