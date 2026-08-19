"""P1.3.5 — Capacity contract estimates from node metadata."""

from __future__ import annotations

from typing import Any


def estimate_capacity(nodes: list[dict], nfr: dict | None = None) -> dict[str, Any]:
    """Estimate throughput/latency using per-node capacity contracts."""
    nfr = nfr or {}
    users = nfr.get("users_per_day") or 1000
    results: list[dict[str, Any]] = []

    for node in nodes:
        d = node.get("data") or {}
        if d.get("kind") in {"zone", "block"}:
            continue
        contract = d.get("capacityContract") or {}
        rps = contract.get("max_rps")
        p99 = contract.get("p99_latency_ms")
        if not rps and not p99:
            continue
        label = d.get("label") or str(node.get("id"))
        peak_rps = users / 86400 * 10  # rough peak factor
        headroom = (rps - peak_rps) / rps * 100 if rps else None
        results.append(
            {
                "node_id": str(node.get("id")),
                "label": label,
                "max_rps": rps,
                "p99_latency_ms": p99,
                "estimated_peak_rps": round(peak_rps, 1),
                "headroom_pct": round(headroom, 1) if headroom is not None else None,
                "at_risk": headroom is not None and headroom < 20,
            }
        )

    return {
        "estimates": results,
        "users_per_day": users,
        "nodes_with_contract": len(results),
    }
