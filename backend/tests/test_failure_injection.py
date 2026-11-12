"""Testes de camada de service — injeção de falha por modo, blast radius e constante unificada.

Testes de ROTA vivem em S2 (test_resilience.py / suites de rota); aqui só o service.
"""

import inspect
import json
import time

from app.services.blast_radius import compute_blast_radius
from app.services.failure_injection import RESILIENCE_MAX_HOPS, inject_failure


def _line_graph():
    """A -> B -> C: A->B sem mitigação ("none"), B->C com retry."""
    nodes = [
        {"id": "a", "data": {"kind": "backend", "label": "A"}},
        {"id": "b", "data": {"kind": "backend", "label": "B"}},
        {"id": "c", "data": {"kind": "backend", "label": "C"}},
    ]
    edges = [
        {"id": "ab", "source": "a", "target": "b"},
        {"id": "bc", "source": "b", "target": "c", "data": {"failureBehavior": "retry"}},
    ]
    return nodes, edges


def _retry_chain():
    """A -> B -> C -> D: A->B retry, B->C dlq, C->D sem mitigação."""
    nodes = [{"id": nid, "data": {"kind": "backend", "label": nid.upper()}} for nid in ("a", "b", "c", "d")]
    edges = [
        {"id": "ab", "source": "a", "target": "b", "data": {"failureBehavior": "retry"}},
        {"id": "bc", "source": "b", "target": "c", "data": {"failureBehavior": "dlq"}},
        {"id": "cd", "source": "c", "target": "d"},
    ]
    return nodes, edges


def _fallback_chain():
    """A -> B(fallback) -> C: o fallback corta a propagação em modo down."""
    nodes = [
        {"id": "a", "data": {"kind": "backend", "label": "A"}},
        {"id": "b", "data": {"kind": "backend", "label": "B"}},
        {"id": "c", "data": {"kind": "backend", "label": "C"}},
    ]
    edges = [
        {"id": "ab", "source": "a", "target": "b", "data": {"failureBehavior": "fallback"}},
        {"id": "bc", "source": "b", "target": "c"},
    ]
    return nodes, edges


def _long_chain(n):
    nodes = [{"id": f"n{i}", "data": {"kind": "backend", "label": f"S{i}"}} for i in range(n)]
    edges = [{"id": f"e{i}", "source": f"n{i}", "target": f"n{i + 1}"} for i in range(n - 1)]
    return nodes, edges


# ---------------------------------------------------------------- modo down


def test_mode_down_unreachable_propagates():
    nodes, edges = _line_graph()
    result = inject_failure(nodes, edges, "a", mode="down")
    assert result["ok"] is True
    assert result["unreachable_node_ids"] == ["a", "b"]
    # B->C tem retry: C fica degradado, não unreachable.
    assert result["degraded_node_ids"] == ["c"]
    assert result["journeys_broken_pct"] == 66.7  # 2 de 3 serviços


def test_mode_down_retry_and_dlq_keep_flow_degraded():
    nodes, edges = _retry_chain()
    result = inject_failure(nodes, edges, "a", mode="down")
    assert result["unreachable_node_ids"] == ["a", "d"]
    assert result["degraded_node_ids"] == ["b", "c"]


def test_mode_down_fallback_cuts_propagation():
    nodes, edges = _fallback_chain()
    result = inject_failure(nodes, edges, "a", mode="down")
    assert result["unreachable_node_ids"] == ["a"]
    assert result["degraded_node_ids"] == ["b"]
    assert "c" not in result["affected_node_ids"]
    assert len(result["fallback_activations"]) == 1
    assert result["fallback_activations"][0]["edge_behavior"] == "fallback"


def test_mode_down_respects_max_hops():
    nodes, edges = _long_chain(10)
    result = inject_failure(nodes, edges, "n0", mode="down", max_hops=3)
    assert result["unreachable_node_ids"] == ["n0", "n1", "n2", "n3"]
    assert "n4" not in result["affected_node_ids"]


# ------------------------------------------------------------- modo timeout


def test_mode_timeout_never_unreachable():
    nodes, edges = _retry_chain()
    result = inject_failure(nodes, edges, "a", mode="timeout")
    assert result["unreachable_node_ids"] == []
    # A -> B(retry): B estende 1 hop. B -> C(dlq): C é o 1 hop além — para aí.
    assert result["degraded_node_ids"] == ["a", "b", "c"]
    assert "d" not in result["affected_node_ids"]
    assert result["journeys_broken_pct"] == 0.0


def test_mode_timeout_no_retry_no_extension():
    nodes, edges = _line_graph()
    result = inject_failure(nodes, edges, "a", mode="timeout")
    # A -> B é "none": B vira vizinho direto degradado, mas não estende; C não é atingido.
    assert result["unreachable_node_ids"] == []
    assert result["degraded_node_ids"] == ["a", "b"]
    assert "c" not in result["affected_node_ids"]


def test_mode_timeout_extension_does_not_chain():
    # A retry -> B retry -> C: a extensão via retry/dlq acontece apenas
    # 1 hop além do nó falho — C é atingido, D não.
    nodes = [{"id": nid, "data": {"kind": "backend", "label": nid.upper()}} for nid in ("a", "b", "c", "d")]
    edges = [
        {"id": "ab", "source": "a", "target": "b", "data": {"failureBehavior": "retry"}},
        {"id": "bc", "source": "b", "target": "c", "data": {"failureBehavior": "retry"}},
        {"id": "cd", "source": "c", "target": "d"},
    ]
    result = inject_failure(nodes, edges, "a", mode="timeout")
    assert result["degraded_node_ids"] == ["a", "b", "c"]
    assert "d" not in result["affected_node_ids"]


# --------------------------------------------------------- modo degraded


def test_mode_degraded_only_direct_neighbors():
    nodes, edges = _retry_chain()
    result = inject_failure(nodes, edges, "a", mode="degraded")
    assert result["unreachable_node_ids"] == []
    assert result["degraded_node_ids"] == ["a", "b"]
    assert "c" not in result["affected_node_ids"]
    assert "d" not in result["affected_node_ids"]


# ------------------------------------------------------ validação e métricas


def test_invalid_mode_rejected():
    nodes, edges = _line_graph()
    result = inject_failure(nodes, edges, "a", mode="cascade")
    assert result["ok"] is False
    assert "cascade" in result["error"]


def test_no_service_nodes_reports_zero_pct():
    nodes = [
        {"id": "z1", "data": {"kind": "zone", "label": "VPC"}},
        {"id": "bl1", "data": {"kind": "block", "label": "Checkout"}},
    ]
    result = inject_failure(nodes, [], "z1", mode="down")
    assert result["journeys_broken_pct"] == 0.0  # vazio = 0.0, nunca 100


def test_determinism_same_input_same_output():
    nodes, edges = _retry_chain()
    for mode in ("down", "timeout", "degraded"):
        first = inject_failure(nodes, edges, "a", mode=mode)
        second = inject_failure(nodes, edges, "a", mode=mode)
        assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


# -------------------------------------------------------------- blast radius


def test_blast_radius_per_hop_lists_sorted():
    nodes = [
        {"id": "o", "data": {"kind": "backend", "label": "O"}},
        *[
            {"id": name, "data": {"kind": "backend", "label": name.upper()}}
            for name in ("zeta", "alpha", "mike", "bravo", "charlie")
        ],
    ]
    edges = [{"id": f"u-{name}", "source": name, "target": "o"} for name in ("zeta", "alpha", "mike", "bravo", "charlie")]
    result = compute_blast_radius(nodes, edges, "o")
    assert result["ok"] is True
    assert result["hops"]["0"] == ["o"]
    assert result["hops"]["1"] == ["alpha", "bravo", "charlie", "mike", "zeta"]


def test_blast_radius_forwards_mode():
    nodes, edges = _line_graph()
    result = compute_blast_radius(nodes, edges, "a", mode="degraded")
    assert result["ok"] is True
    assert result["unreachable_node_ids"] == []
    assert result["degraded_node_ids"] == ["a", "b"]


def test_blast_radius_500_nodes_under_50ms():
    nodes, edges = _long_chain(500)
    start = time.perf_counter()
    # max_hops total: a perf test precisa atravessar o grafo inteiro,
    # senão o BFS para no default (8) e o resto do grafo fica inerte.
    result = compute_blast_radius(nodes, edges, "n0", max_hops=len(nodes))
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert result["ok"] is True
    assert len(result["affected_node_ids"]) > 100
    assert elapsed_ms < 50, f"blast radius em 500 nós levou {elapsed_ms:.1f}ms"


def test_max_hops_constant_unified():
    assert RESILIENCE_MAX_HOPS == 8
    inj_default = inspect.signature(inject_failure).parameters["max_hops"].default
    blast_default = inspect.signature(compute_blast_radius).parameters["max_hops"].default
    assert inj_default == blast_default == RESILIENCE_MAX_HOPS
