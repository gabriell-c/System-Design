"""P1.3.4 — Private organization catalog management."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.graph import Graph, new_uuid
from app.models.user import User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/v1/catalog/private", tags=["private-catalog"])


class CatalogItemCreate(BaseModel):
    id: str
    kind: str
    label: str
    tech: str
    description: str
    limits: dict | None = None
    ha_model: str | None = None
    pricing_tier: str | None = None
    sla_pct: float | None = None
    rps_guidance: str | None = None


class CatalogItemOut(BaseModel):
    id: str
    kind: str
    label: str
    tech: str
    description: str
    limits: dict
    ha_model: str
    pricing_tier: str
    sla_pct: float
    rps_guidance: str
    created_at: str
    updated_at: str


def _get_org_catalog(db: Session, user: User) -> Graph:
    """Get or create the organization's private catalog."""
    org_id = getattr(user, "org_id", "default")
    catalog = db.query(Graph).filter(Graph.name == f"private-catalog-{org_id}").first()
    if not catalog:
        catalog = Graph(
            id=new_uuid(),
            name=f"private-catalog-{org_id}",
            context_text="Private organization catalog",
            nodes_json="[]",
            edges_json="[]",
        )
        db.add(catalog)
        db.commit()
        db.refresh(catalog)
    return catalog


@router.get("/")
def list_items(db: Session = Depends(get_db), user=Depends(get_current_user)) -> list[dict]:
    catalog = _get_org_catalog(db, user)
    items = json.loads(catalog.nodes_json or "[]")
    return items


@router.post("/")
def create_item(payload: CatalogItemCreate, db: Session = Depends(get_db), user=Depends(get_current_user)) -> dict:
    catalog = _get_org_catalog(db, user)
    items = json.loads(catalog.nodes_json or "[]")

    # Check for duplicate ID
    if any(item.get("id") == payload.id for item in items):
        raise HTTPException(status_code=400, detail="Item with this ID already exists")

    item = {
        "id": payload.id,
        "kind": payload.kind,
        "label": payload.label,
        "tech": payload.tech,
        "description": payload.description,
        "limits": payload.limits or {},
        "ha_model": payload.ha_model or "single-az",
        "pricing_tier": payload.pricing_tier or "standard",
        "sla_pct": payload.sla_pct or 99.9,
        "rps_guidance": payload.rps_guidance or "",
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
    }
    items.append(item)
    catalog.nodes_json = json.dumps(items, ensure_ascii=False)
    catalog.updated_at = datetime.now(UTC)
    db.commit()
    return item


@router.put("/{item_id}")
def update_item(item_id: str, payload: CatalogItemCreate, db: Session = Depends(get_db), user=Depends(get_current_user)) -> dict:
    catalog = _get_org_catalog(db, user)
    items = json.loads(catalog.nodes_json or "[]")

    # Find and update
    for i, item in enumerate(items):
        if item.get("id") == item_id:
            item.update({
                "kind": payload.kind,
                "label": payload.label,
                "tech": payload.tech,
                "description": payload.description,
                "limits": payload.limits or {},
                "ha_model": payload.ha_model or "single-az",
                "pricing_tier": payload.pricing_tier or "standard",
                "sla_pct": payload.sla_pct or 99.9,
                "rps_guidance": payload.rps_guidance or "",
                "updated_at": datetime.now(UTC).isoformat(),
            })
            break
    else:
        raise HTTPException(status_code=404, detail="Item not found")

    catalog.nodes_json = json.dumps(items, ensure_ascii=False)
    catalog.updated_at = datetime.now(UTC)
    db.commit()
    return items[i]


@router.delete("/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)) -> dict:
    catalog = _get_org_catalog(db, user)
    items = json.loads(catalog.nodes_json or "[]")

    # Remove
    original_len = len(items)
    items = [item for item in items if item.get("id") != item_id]

    if len(items) == original_len:
        raise HTTPException(status_code=404, detail="Item not found")

    catalog.nodes_json = json.dumps(items, ensure_ascii=False)
    catalog.updated_at = datetime.now(UTC)
    db.commit()
    return {"ok": True}
