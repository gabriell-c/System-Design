"""P0.5.2 / P0.5.3 — SLI/SLO por serviço e error budget burn rate."""

from __future__ import annotations

from typing import Any


def _node_data(node: dict[str, Any]) -> dict[str, Any]:
    data = node.get("data")
    return data if isinstance(data, dict) else {}


def compute_service_slos(
    nodes: list[dict[str, Any]],
    nfr: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Cards SLI/SLO por nó de serviço (backend/frontend/cloud)."""
    nfr = nfr or {}
    default_avail = float(nfr.get("slo_availability_pct") or nfr.get("availability_pct") or 99.9)
    default_p99 = int(nfr.get("slo_latency_p99_ms") or nfr.get("latency_p99_ms") or 300)

    cards: list[dict[str, Any]] = []
    for node in nodes:
        data = _node_data(node)
        kind = data.get("kind")
        if kind in ("zone", "block", "swimlane", "note", "cidr", "tenant_boundary"):
            continue
        cap = data.get("capacityContract") if isinstance(data.get("capacityContract"), dict) else {}
        avail = default_avail
        p99 = int(cap.get("p99_latency_ms") or default_p99)
        cards.append(
            {
                "node_id": node.get("id"),
                "label": data.get("label") or node.get("id"),
                "sli_availability_pct": avail,
                "sli_latency_p99_ms": p99,
                "slo_availability_pct": avail,
                "slo_latency_p99_ms": p99,
                "error_budget_remaining_pct": round(max(0.0, 100.0 - (100.0 - avail) * 10), 2),
            }
        )
    return cards[:50]


def error_budget_burn_rate(nfr: dict[str, Any] | None = None) -> dict[str, Any]:
    """Estimativa de burn rate a partir de SLO de disponibilidade."""
    nfr = nfr or {}
    slo = float(nfr.get("slo_availability_pct") or nfr.get("availability_pct") or 99.9)
    allowed_downtime_min_month = (1.0 - slo / 100.0) * 30 * 24 * 60
    burn_1h = allowed_downtime_min_month / (30 * 24) if allowed_downtime_min_month > 0 else 0
    return {
        "slo_availability_pct": slo,
        "allowed_downtime_min_per_month": round(allowed_downtime_min_month, 2),
        "burn_rate_1h_equiv_min": round(burn_1h, 4),
        "status": "healthy" if slo >= 99.9 else "watch" if slo >= 99.0 else "critical",
    }
