"""P0.5.5 — Blast radius: dependências downstream e % de jornadas impactadas."""

from __future__ import annotations

from collections import deque
from typing import Any

from app.services.failure_injection import inject_failure


def compute_blast_radius(
    nodes: list[dict],
    edges: list[dict],
    origin_node_id: str,
    *,
    max_hops: int = 6,
) -> dict[str, Any]:
    """Grafo de dependência + blast a partir de um nó (usa injeção de falha)."""
    injection = inject_failure(nodes, edges, origin_node_id, mode="down", max_hops=max_hops)
    if not injection.get("ok"):
        return injection

    node_map = {str(n.get("id")): n for n in nodes if n.get("id")}
    adj = _reverse_adjacency(edges)

    hops_map: dict[str, int] = {origin_node_id: 0}
    queue: deque[tuple[str, int]] = deque([(origin_node_id, 0)])
    while queue:
        current, hop = queue.popleft()
        if hop >= max_hops:
            continue
        for upstream in adj.get(current, []):
            if upstream in hops_map:
                continue
            hops_map[upstream] = hop + 1
            queue.append((upstream, hop + 1))

    by_hop: dict[int, list[str]] = {}
    for nid, hop in hops_map.items():
        by_hop.setdefault(hop, []).append(nid)

    affected = set(injection.get("affected_node_ids") or [])
    highlight_edges = [
        {"id": e.get("id"), "source": e.get("source"), "target": e.get("target")}
        for e in edges
        if str(e.get("source")) in affected or str(e.get("target")) in affected
    ]

    labels = {
        nid: str((node_map.get(nid, {}).get("data") or {}).get("label") or nid)
        for nid in affected
    }

    return {
        "ok": True,
        "origin_node_id": origin_node_id,
        "origin_label": injection.get("failed_label"),
        "max_hops": max_hops,
        "hops": {str(h): ids for h, ids in sorted(by_hop.items())},
        "affected_node_ids": sorted(affected),
        "unreachable_node_ids": injection.get("unreachable_node_ids") or [],
        "degraded_node_ids": injection.get("degraded_node_ids") or [],
        "highlight_edge_ids": [e["id"] for e in highlight_edges if e.get("id")],
        "highlight_edges": highlight_edges,
        "journeys_broken_pct": injection.get("journeys_broken_pct", 0),
        "critical_path_broken": injection.get("critical_path_broken", 0),
        "node_labels": labels,
        "summary": injection.get("summary"),
    }


def _reverse_adjacency(edges: list[dict]) -> dict[str, list[str]]:
    rev: dict[str, list[str]] = {}
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if src and tgt:
            rev.setdefault(tgt, []).append(src)
    return rev
