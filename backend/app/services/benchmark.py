"""P2.1 — Benchmark de performance (carga simulada no grafo).

Simula operações típicas do editor (indexação + BFS) num grafo e projeta
o custo em `target_nodes` nós.

Custo documentado:

- Indexação + BFS é O(n + e). A fila usa `collections.deque` (popleft
  O(1)); o `list.pop(0)` anterior tornava o próprio benchmark O(n^2) por
  pop — o benchmark estaria medindo a própria ineficiência.
- `projected_ms_at_target` usa upper-bound O(n^2) (documentado):
  `elapsed * (target/n) ** 2`, ou seja, assume crescimento pelo menos
  quadrático. É conservador — superestima grafos cujo layout é linear —
  mas nunca subestima, então a flag de budget é confiável no pior caso.
"""

from __future__ import annotations

import time
from collections import deque
from typing import Any

#: Referência de orçamento: 10ms por 100 nós de grafo.
MS_PER_100_NODES = 10


def run_graph_benchmark(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    *,
    target_nodes: int = 500,
) -> dict[str, Any]:
    """Simula layout + traversals em grafos grandes; documenta limites.

    O orçamento (`passes_budget`) deriva de `target_nodes` via
    `MS_PER_100_NODES` — não há número 500 escondido no código.
    """
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

    visited: set[str] = set()
    # deque: popleft O(1). Com list + pop(0) este loop seria O(n^2).
    queue: deque[str] = deque(list(by_id.keys())[: min(50, len(by_id))])
    pops = 0
    while queue and pops < 2000:
        cur = queue.popleft()
        if cur in visited:
            continue
        visited.add(cur)
        queue.extend(adj.get(cur, [])[:5])
        pops += 1

    elapsed_ms = (time.perf_counter() - started) * 1000
    target = max(1, target_nodes)
    # Upper-bound O(n^2) (documentado): projeção quadrática do tempo
    # medido em `n` nós para `target`.
    projected_ms = elapsed_ms * (target / n) ** 2 if n else 0.0
    budget_ms = target / 100 * MS_PER_100_NODES

    return {
        "node_count": n,
        "edge_count": e,
        "visited_count": len(visited),
        "target_nodes": target_nodes,
        "elapsed_ms": round(elapsed_ms, 2),
        "projected_ms_at_target": round(projected_ms, 2),
        "budget_ms": round(budget_ms, 2),
        "passes_budget": projected_ms < budget_ms,
        "recommendation": (
            f"OK para {target_nodes} nós no editor"
            if projected_ms < budget_ms
            else f"Habilitar LOD / onlyRenderVisibleElements para grafos >{target_nodes} nós"
        ),
    }
