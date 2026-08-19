"""P1.1.6 — Polyglot persistence map (DB-per-service matrix)."""

from __future__ import annotations

from typing import Any


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


def _blob(node: dict) -> str:
    d = _node_data(node)
    parts = [
        str(d.get("label") or ""),
        str(d.get("tech") or ""),
        str(d.get("catalogId") or ""),
        str((d.get("config") or {}).get("engine") or ""),
        str((d.get("config") or {}).get("service") or ""),
    ]
    return " ".join(parts).lower()


def build_polyglot_map(nodes: list[dict], edges: list[dict]) -> dict[str, Any]:
    """Build service → database technology matrix from canvas."""
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]
    backends = [n for n in cards if _node_data(n).get("kind") == "backend"]
    databases = [n for n in cards if _node_data(n).get("kind") == "database"]

    # Map backend id → label
    id_to_label = {str(n.get("id")): _node_data(n).get("label") or str(n.get("id")) for n in cards}

    # Edges: backend → database
    service_dbs: dict[str, list[dict[str, str]]] = {}
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        src_node = next((n for n in nodes if str(n.get("id")) == src), None)
        tgt_node = next((n for n in nodes if str(n.get("id")) == tgt), None)
        if not src_node or not tgt_node:
            continue
        sd = _node_data(src_node)
        td = _node_data(tgt_node)
        if sd.get("kind") == "backend" and td.get("kind") == "database":
            svc = id_to_label.get(src, src)
            service_dbs.setdefault(svc, []).append(
                {
                    "database_id": tgt,
                    "database_label": td.get("label") or tgt,
                    "engine": td.get("tech") or (td.get("config") or {}).get("engine") or "unknown",
                    "pii_sensitivity": td.get("piiSensitivity") or "none",
                }
            )
        elif sd.get("kind") == "database" and td.get("kind") == "backend":
            svc = id_to_label.get(tgt, tgt)
            service_dbs.setdefault(svc, []).append(
                {
                    "database_id": src,
                    "database_label": sd.get("label") or src,
                    "engine": sd.get("tech") or (sd.get("config") or {}).get("engine") or "unknown",
                    "pii_sensitivity": sd.get("piiSensitivity") or "none",
                }
            )

    # Orphan DBs (not linked to any service)
    linked_db_ids = {db["database_id"] for dbs in service_dbs.values() for db in dbs}
    orphan_dbs = [
        {
            "database_id": str(n.get("id")),
            "database_label": _node_data(n).get("label") or str(n.get("id")),
            "engine": _node_data(n).get("tech") or "unknown",
            "pii_sensitivity": _node_data(n).get("piiSensitivity") or "none",
        }
        for n in databases
        if str(n.get("id")) not in linked_db_ids
    ]

    # Shared DB detection (same DB used by multiple services)
    db_usage: dict[str, list[str]] = {}
    for svc, dbs in service_dbs.items():
        for db in dbs:
            db_usage.setdefault(db["database_id"], []).append(svc)

    shared_databases = [
        {
            "database_id": db_id,
            "database_label": next(
                (db["database_label"] for dbs in service_dbs.values() for db in dbs if db["database_id"] == db_id),
                db_id,
            ),
            "services": svcs,
            "anti_pattern": len(svcs) > 1,
        }
        for db_id, svcs in db_usage.items()
        if len(svcs) > 1
    ]

    engines = sorted({db["engine"] for dbs in service_dbs.values() for db in dbs} | {d["engine"] for d in orphan_dbs})

    return {
        "services": [
            {
                "service": svc,
                "databases": dbs,
                "polyglot": len({db["engine"] for db in dbs}) > 1,
            }
            for svc, dbs in sorted(service_dbs.items())
        ],
        "orphan_databases": orphan_dbs,
        "shared_databases": shared_databases,
        "engines_in_use": engines,
        "summary": {
            "service_count": len(service_dbs) or len(backends),
            "database_count": len(databases),
            "shared_db_count": len(shared_databases),
            "polyglot_services": sum(1 for s in service_dbs.values() if len({db["engine"] for db in s}) > 1),
        },
    }
