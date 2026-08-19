"""P2.1 — Benchmark de performance (carga simulada no grafo)."""

from __future__ import annotations

import time
from typing import Any


def run_graph_benchmark(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    *,
    target_nodes: int = 500,
) -> dict[str, Any]:
    """Simula layout + traversals em grafos grandes; documenta limites."""
    n = len(nodes)
    e = len(edges)
    started = time.perf_counter()

    # Simula operações típicas do editor (indexação + BFS leve)
    by_id = {str(node.get("id")): node for node in nodes if node.get("id")}
    adj: dict[str, list[str]] = {k: [] for k in by_id}
    for edge in edges:
        s, t = str(edge.get("source")), str(edge.get("target"))
        if s in adj and t in by_id:
            adj[s].append(t)

    visited = set()
    queue = list(by_id.keys())[: min(50, len(by_id))]
    hops = 0
    while queue and hops < 2000:
        cur = queue.pop(0)
        if cur in visited:
            continue
        visited.add(cur)
        queue.extend(adj.get(cur, [])[:5])
        hops += 1

    elapsed_ms = (time.perf_counter() - started) * 1000
    projected_ms = elapsed_ms * (max(1, target_nodes) / max(1, n)) if n else elapsed_ms

    return {
        "node_count": n,
        "edge_count": e,
        "target_nodes": target_nodes,
        "elapsed_ms": round(elapsed_ms, 2),
        "projected_ms_at_target": round(projected_ms, 2),
        "passes_500_node_budget": projected_ms < 5000,
        "recommendation": (
            "OK para 500 nós no editor"
            if projected_ms < 5000
            else "Habilitar LOD / onlyRenderVisibleElements para grafos >500 nós"
        ),
    }
