"""P0.5.6 — Circuit breakers como componente no grafo (nó ou decorador de aresta)."""

from __future__ import annotations

from typing import Any


def _node_data(node: dict) -> dict[str, Any]:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _edge_data(edge: dict) -> dict[str, Any]:
    data = edge.get("data") or {}
    return data if isinstance(data, dict) else {}


def analyze_circuit_breakers(nodes: list[dict], edges: list[dict]) -> dict[str, Any]:
    """Lista breakers explícitos (nó pat-circuit-breaker / sec-sg) e implícitos (aresta)."""
    breakers: list[dict[str, Any]] = []
    gaps: list[str] = []

    for node in nodes:
        data = _node_data(node)
        catalog = str(data.get("catalogId") or "")
        cb = data.get("circuitBreaker")
        if catalog in {"pat-circuit-breaker", "sec-sg"} or cb:
            cfg = cb if isinstance(cb, dict) else {}
            breakers.append(
                {
                    "type": "node",
                    "node_id": str(node.get("id")),
                    "label": str(data.get("label") or node.get("id")),
                    "threshold": cfg.get("failure_threshold", 5),
                    "window_seconds": cfg.get("window_seconds", 60),
                    "fallback_target_id": cfg.get("fallback_target_id"),
                    "state": cfg.get("state", "closed"),
                }
            )

    for edge in edges:
        data = _edge_data(edge)
        cb = data.get("circuitBreaker")
        behavior = data.get("failureBehavior")
        if cb or behavior in {"fallback", "fail_fast"}:
            cfg = cb if isinstance(cb, dict) else {}
            breakers.append(
                {
                    "type": "edge",
                    "edge_id": str(edge.get("id")),
                    "source": str(edge.get("source")),
                    "target": str(edge.get("target")),
                    "failure_behavior": behavior,
                    "threshold": cfg.get("failure_threshold", 5),
                    "window_seconds": cfg.get("window_seconds", 60),
                    "fallback_target_id": cfg.get("fallback_target_id"),
                    "state": cfg.get("state", "closed"),
                }
            )

    critical = [e for e in edges if _edge_data(e).get("isCriticalPath")]
    for edge in critical:
        data = _edge_data(edge)
        if not data.get("circuitBreaker") and data.get("failureBehavior") in {None, "none"}:
            gaps.append(
                f"Caminho crítico {edge.get('source')}→{edge.get('target')} sem breaker nem failureBehavior."
            )

    return {
        "breakers": breakers,
        "breaker_count": len(breakers),
        "gaps": gaps,
        "recommendation": (
            "Adicione circuitBreaker na aresta ou card pat-circuit-breaker entre serviços acoplados."
            if gaps
            else "Breakers configurados nos caminhos críticos."
        ),
    }
