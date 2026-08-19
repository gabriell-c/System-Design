"""P0.4.2 — Policy as code (regras da organização)."""

from __future__ import annotations

from typing import Any

PII_CATALOG_IDS = {"db-postgres", "db-mysql", "db-mongodb", "db-redshift", "db-dynamodb"}
PRIVATE_ZONE_KINDS = {"subnet_private", "security_boundary", "layer"}


def _node_data(node: dict[str, Any]) -> dict[str, Any]:
    data = node.get("data")
    return data if isinstance(data, dict) else {}


def _zone_kind(node: dict[str, Any]) -> str | None:
    data = _node_data(node)
    if data.get("kind") != "zone":
        return None
    return str(data.get("zoneKind") or "")


def evaluate_policies(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Retorna findings com policy_id para violações conhecidas."""
    findings: list[dict[str, Any]] = []
    node_by_id = {str(n.get("id")): n for n in nodes if n.get("id")}

    # PII só em subnet privada / security boundary
    for node in nodes:
        data = _node_data(node)
        catalog = str(data.get("catalogId") or "")
        pii = data.get("piiSensitivity") in ("high", "restricted", "medium")
        if catalog in PII_CATALOG_IDS or pii:
            parent_id = node.get("parentId")
            parent = node_by_id.get(str(parent_id)) if parent_id else None
            zone = _zone_kind(parent) if parent else None
            if zone not in PRIVATE_ZONE_KINDS:
                findings.append(
                    {
                        "policy_id": "pii-private-kms",
                        "severity": "critical",
                        "node_id": node.get("id"),
                        "title": "PII fora de zona privada",
                        "detail": f"«{data.get('label', catalog)}» deve ficar em subnet privada + KMS.",
                    }
                )

    # RDS/database sem SG adjacente (aresta para sec-sg ou nó SG)
    db_nodes = [n for n in nodes if _node_data(n).get("kind") == "database" or "db-" in str(_node_data(n).get("catalogId", ""))]
    sg_ids = {
        str(n.get("id"))
        for n in nodes
        if str(_node_data(n).get("catalogId", "")) == "sec-sg" or _node_data(n).get("kind") == "security"
    }
    for db in db_nodes:
        nid = str(db.get("id"))
        linked = any(
            (e.get("source") == nid or e.get("target") == nid)
            and (e.get("source") in sg_ids or e.get("target") in sg_ids)
            for e in edges
        )
        if not linked and not _node_data(db).get("securityGroupRules"):
            findings.append(
                {
                    "policy_id": "db-requires-sg",
                    "severity": "warning",
                    "node_id": nid,
                    "title": "Database sem Security Group",
                    "detail": "Todo store persistente deve ter SG/NACL documentado.",
                }
            )

    # RDS público — catalog cloud-aws-rds em subnet_public
    for node in nodes:
        data = _node_data(node)
        if str(data.get("catalogId", "")) not in {"cloud-aws-rds", "db-postgres", "db-mysql"}:
            continue
        parent_id = node.get("parentId")
        parent = node_by_id.get(str(parent_id)) if parent_id else None
        if parent and _zone_kind(parent) == "subnet_public":
            findings.append(
                {
                    "policy_id": "no-public-rds",
                    "severity": "critical",
                    "node_id": node.get("id"),
                    "title": "RDS em subnet pública",
                    "detail": "Política da org: sem RDS público.",
                }
            )

    return findings
