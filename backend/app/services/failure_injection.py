"""P0.5.4 — Injeção de falha em nó selecionado (não evento aleatório)."""

from __future__ import annotations

from collections import deque
from typing import Any


def _node_data(node: dict) -> dict[str, Any]:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _edge_data(edge: dict) -> dict[str, Any]:
    data = edge.get("data") or {}
    return data if isinstance(data, dict) else {}


def _label(node: dict) -> str:
    return str(_node_data(node).get("label") or node.get("id") or "?")


def _build_adjacency(edges: list[dict]) -> dict[str, list[tuple[str, dict]]]:
    adj: dict[str, list[tuple[str, dict]]] = {}
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if not src or not tgt:
            continue
        adj.setdefault(src, []).append((tgt, _edge_data(edge)))
    return adj


def inject_failure(
    nodes: list[dict],
    edges: list[dict],
    failed_node_id: str,
    *,
    mode: str = "down",
    max_hops: int = 8,
) -> dict[str, Any]:
    """Simula falha no nó `failed_node_id` e propaga impacto downstream."""
    node_map = {str(n.get("id")): n for n in nodes if n.get("id")}
    if failed_node_id not in node_map:
        return {"ok": False, "error": f"Nó '{failed_node_id}' não encontrado no grafo."}

    adj = _build_adjacency(edges)
    card_nodes = [
        nid
        for nid, n in node_map.items()
        if _node_data(n).get("kind") not in {"zone", "block"}
    ]
    total_cards = max(len(card_nodes), 1)

    unreachable: set[str] = set()
    degraded: set[str] = set()
    fallbacks: list[dict[str, str]] = []
    queue: deque[tuple[str, int]] = deque([(failed_node_id, 0)])
    visited: set[str] = {failed_node_id}

    unreachable.add(failed_node_id)

    while queue:
        current, hop = queue.popleft()
        if hop >= max_hops:
            continue
        for target, edge_data in adj.get(current, []):
            if target in visited:
                continue
            visited.add(target)
            behavior = edge_data.get("failureBehavior") or "none"
            if behavior == "fallback":
                degraded.add(target)
                fallbacks.append(
                    {
                        "edge_behavior": "fallback",
                        "from": _label(node_map.get(current, {})),
                        "to": _label(node_map.get(target, {})),
                        "detail": "Tráfego desviado — serviço degradado, não indisponível.",
                    }
                )
                continue
            if behavior in {"retry", "dlq"}:
                degraded.add(target)
                fallbacks.append(
                    {
                        "edge_behavior": behavior,
                        "from": _label(node_map.get(current, {})),
                        "to": _label(node_map.get(target, {})),
                        "detail": f"Comportamento {behavior} — latência elevada ou fila.",
                    }
                )
                queue.append((target, hop + 1))
                continue
            unreachable.add(target)
            queue.append((target, hop + 1))

    critical_edges = [e for e in edges if _edge_data(e).get("isCriticalPath")]
    broken_critical = [
        e
        for e in critical_edges
        if str(e.get("source")) in unreachable or str(e.get("target")) in unreachable
    ]
    journeys_broken_pct = round(len(unreachable) / total_cards * 100, 1)

    mode_impact = {
        "down": "Indisponível — HTTP 503 / timeout.",
        "timeout": "Latência extrema — p99 > SLO.",
        "degraded": "Capacidade reduzida — error budget queimando.",
    }

    return {
        "ok": True,
        "failed_node_id": failed_node_id,
        "failed_label": _label(node_map[failed_node_id]),
        "mode": mode,
        "mode_detail": mode_impact.get(mode, mode_impact["down"]),
        "unreachable_node_ids": sorted(unreachable),
        "degraded_node_ids": sorted(degraded - unreachable),
        "fallback_activations": fallbacks,
        "critical_path_broken": len(broken_critical),
        "critical_path_total": len(critical_edges),
        "journeys_broken_pct": journeys_broken_pct,
        "affected_node_ids": sorted(unreachable | degraded),
        "summary": (
            f"Falha em '{_label(node_map[failed_node_id])}' ({mode}): "
            f"{len(unreachable)} nós indisponíveis, {len(degraded)} degradados, "
            f"{journeys_broken_pct}% dos serviços afetados."
        ),
    }
