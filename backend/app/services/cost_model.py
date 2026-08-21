"""P0.5.7 — Custo por serviço/região/tier (ligado ao catálogo)."""

from __future__ import annotations

from typing import Any

from app.services.heuristic import estimate_monthly_cost
from app.services.knowledge import COST_USD_MONTH

CATALOG_COST_KEY: dict[str, tuple[str, float]] = {
    "cloud-aws-ec2": ("EC2:t3.medium", COST_USD_MONTH["EC2:t3.medium"]),
    "cloud-aws-ecs": ("EC2:t3.medium", COST_USD_MONTH["EC2:t3.medium"]),
    "cloud-aws-lambda": ("Lambda:1M", 8.0),
    "cloud-aws-s3": ("S3:50GB", COST_USD_MONTH["S3:50GB"]),
    "cloud-aws-cf": ("CloudFront:50GB", COST_USD_MONTH["CloudFront:50GB"]),
    "cloud-aws-alb": ("ALB", COST_USD_MONTH["ALB"]),
    "db-postgres": ("RDS:db.t3.micro", COST_USD_MONTH["RDS:db.t3.micro"]),
    "db-mysql": ("RDS:db.t3.micro", COST_USD_MONTH["RDS:db.t3.micro"]),
    "db-redis": ("ElastiCache:t3.micro", COST_USD_MONTH["ElastiCache:t3.micro"]),
    "db-elasticsearch": ("EC2:t3.large", COST_USD_MONTH["EC2:t3.large"]),
    "dep-vercel": ("Vercel:Pro", COST_USD_MONTH["Vercel:Pro"]),
    "dep-k8s": ("Kubernetes:managed", COST_USD_MONTH["Kubernetes:managed"]),
}


def _node_data(node: dict) -> dict[str, Any]:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _region_from_node(node: dict, nodes: list[dict]) -> str:
    nid = str(node.get("id"))
    parent_map = {str(n.get("id")): str(n.get("parentId") or "") for n in nodes}
    current = parent_map.get(nid, "")
    while current:
        parent = next((n for n in nodes if str(n.get("id")) == current), None)
        if not parent:
            break
        data = _node_data(parent)
        if data.get("kind") == "zone" and data.get("zoneKind") == "region":
            return str(data.get("label") or "region")
        current = parent_map.get(current, "")
    config = _node_data(node).get("config") or {}
    return str(config.get("region") or "default")


def estimate_cost_breakdown(nodes: list[dict], edges: list[dict] | None = None) -> dict[str, Any]:
    """Custo mensal estimado por nó, região e tier."""
    _ = edges
    line_items: list[dict[str, Any]] = []
    by_region: dict[str, float] = {}
    by_tier: dict[str, float] = {}

    for node in nodes:
        data = _node_data(node)
        if data.get("kind") in {"zone", "block"}:
            continue
        catalog_id = str(data.get("catalogId") or "")
        label = str(data.get("label") or node.get("id"))
        node_id = str(node.get("id"))
        region = _region_from_node(node, nodes)
        contract = data.get("capacityContract") or {}
        tier = "production" if contract.get("max_rps", 0) > 500 else "standard"

        cost_usd = 0.0
        cost_key = "generic"
        if catalog_id in CATALOG_COST_KEY:
            cost_key, cost_usd = CATALOG_COST_KEY[catalog_id]
        else:
            tech = str(data.get("tech") or "").lower()
            if "lambda" in tech:
                cost_key, cost_usd = "Lambda:1M", 8.0
            elif "postgres" in tech or "mysql" in tech:
                cost_key, cost_usd = "RDS:db.t3.micro", COST_USD_MONTH["RDS:db.t3.micro"]
            elif "redis" in tech:
                cost_key, cost_usd = "ElastiCache:t3.micro", COST_USD_MONTH["ElastiCache:t3.micro"]
            else:
                cost_usd = 12.0

        line_items.append(
            {
                "node_id": node_id,
                "label": label,
                "catalog_id": catalog_id,
                "region": region,
                "tier": tier,
                "cost_key": cost_key,
                "cost_usd_month": round(cost_usd, 2),
            }
        )
        by_region[region] = round(by_region.get(region, 0) + cost_usd, 2)
        by_tier[tier] = round(by_tier.get(tier, 0) + cost_usd, 2)

    total = round(sum(i["cost_usd_month"] for i in line_items), 2)
    heuristic_total = estimate_monthly_cost(nodes)

    return {
        "line_items": line_items,
        "total_usd_month": total,
        "heuristic_total_usd_month": heuristic_total,
        "by_region": by_region,
        "by_tier": by_tier,
        "node_count": len(line_items),
        "summary": f"Estimativa: US$ {total}/mês em {len(line_items)} serviços ({len(by_region)} regiões).",
    }
