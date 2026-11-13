"""P2.2.3 — ACL por squad/owner_team em grafos.

IDOR (R1): GET passa por `get_graph_or_404` (leitura); POST/DELETE exigem
permissão de edição (`write=True`) — usuário com ACL só de leitura continua
com GET 200, mas cai em 404 nas escritas (mudança de comportamento
documentada; testes travam a semântica nova em
`tests/test_network_acl_boundary_routes.py`).

Tolerância em leitura legada: linhas históricas podem ter `team`/`role` que
violam a validação atual de `TeamAccess` (ex.: e-mail como team — `@` fora
do charset permitido desde R9). A leitura NÃO normaliza o passado:
`TeamAccessOut` aceita qualquer string; a validação estrita (422) vale só
para escritas.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import GraphAccess, new_uuid
from app.models.user import User
from app.routes._graph_helpers import get_graph_or_404
from app.routes.auth import get_current_user
from app.schemas.graph import TeamAccess

router = APIRouter(prefix="/api/v1", tags=["acl"])


class TeamAccessOut(BaseModel):
    """Saída de leitura tolerante a valores legados (ver docstring do módulo).

    Wire shape `{team, role}` idêntico ao antigo; sem re-validação —
    `team`/`role` são `str` soltos de propósito.
    """

    team: str
    role: str


@router.get("/graphs/{graph_id}/access", response_model=list[TeamAccessOut])
def list_graph_access(
    graph_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
):
    get_graph_or_404(db, current_user, graph_id)
    rows = db.execute(select(GraphAccess).where(GraphAccess.graph_id == graph_id)).scalars().all()
    return [TeamAccessOut(team=r.team, role=r.role) for r in rows]


@router.post("/graphs/{graph_id}/access", response_model=TeamAccessOut)
def add_graph_access(
    graph_id: str,
    access: TeamAccess,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
):
    # R1: escrever ACL exige editar o grafo (dono/senior/grant write|admin).
    # Role inválido já é 422 no schema (TeamAccess.role é Literal).
    get_graph_or_404(db, current_user, graph_id, write=True)
    existing = (
        db.execute(select(GraphAccess).where(GraphAccess.graph_id == graph_id, GraphAccess.team == access.team))
        .scalars()
        .first()
    )
    if existing:
        existing.role = access.role
        db.commit()
        return TeamAccessOut(team=existing.team, role=existing.role)
    db.add(GraphAccess(id=new_uuid(), graph_id=graph_id, team=access.team, role=access.role))
    db.commit()
    return TeamAccessOut(team=access.team, role=access.role)


@router.delete("/graphs/{graph_id}/access/{team}")
def delete_graph_access(
    graph_id: str,
    team: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: User = Depends(get_current_user),
):
    # R1: checagem de ownership ANTES do lookup da regra — terceiro não
    # descobre quais rules existem (IDOR-safe).
    get_graph_or_404(db, current_user, graph_id, write=True)
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
