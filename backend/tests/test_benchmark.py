"""Testes do benchmark de performance — determinismo, projeção, budget e fila O(1)."""

from app.services.benchmark import run_graph_benchmark


def _graph(n):
    """Cadeia n0 -> ... -> n(n-1) + fan-out extra para encher a fila do BFS."""
    nodes = [{"id": f"n{i}", "data": {"kind": "backend", "label": f"S{i}"}} for i in range(n)]
    edges = [{"source": f"n{i}", "target": f"n{i + 1}"} for i in range(n - 1)]
    for i in range(0, n, 7):
        edges.append({"source": f"n{i}", "target": f"n{(i * 13 + 3) % n}"})
    return nodes, edges


def test_traversal_deterministic():
    nodes, edges = _graph(400)
    first = run_graph_benchmark(nodes, edges, target_nodes=400)
    second = run_graph_benchmark(nodes, edges, target_nodes=400)
    assert first["visited_count"] == second["visited_count"] > 0
    assert first["node_count"] == second["node_count"] == 400
    assert first["edge_count"] == second["edge_count"]


def test_projection_monotonic():
    # Projeção O(n^2): alvo maior deve projetar sempre mais tempo.
    nodes, edges = _graph(2000)
    base = run_graph_benchmark(nodes, edges, target_nodes=2000)
    bigger = run_graph_benchmark(nodes, edges, target_nodes=8000)
    assert bigger["projected_ms_at_target"] > base["projected_ms_at_target"]


def test_budget_derives_from_target_nodes():
    nodes, edges = _graph(500)
    result = run_graph_benchmark(nodes, edges, target_nodes=500)
    assert "passes_500_node_budget" not in result
    assert result["budget_ms"] == 50.0  # 500 nós x 10ms/100 nós
    assert result["passes_budget"] == (result["projected_ms_at_target"] < result["budget_ms"])


def test_traversal_fast_guard_deque():
    # Guarda O(n^2) de queue.pop(0): um grafo de fronteira larga (raiz com
    # 1000 filhos, cada um com 5 folhas) enche a fila do BFS; com deque
    # (popleft O(1)) o benchmark deve fechar em 100ms. Se alguém
    # reintroduzir list + pop(0) (e piorar o cap de pops), o tempo explode
    # para centenas de ms e este teste pega.
    nodes = [{"id": "r", "data": {"kind": "backend", "label": "R"}}]
    edges = []
    for i in range(1000):
        cid = f"c{i}"
        nodes.append({"id": cid, "data": {"kind": "backend", "label": cid}})
        edges.append({"source": "r", "target": cid})
        for k in range(5):
            gid = f"g{i}-{k}"
            nodes.append({"id": gid, "data": {"kind": "backend", "label": gid}})
            edges.append({"source": cid, "target": gid})
    result = run_graph_benchmark(nodes, edges, target_nodes=len(nodes))
    assert result["node_count"] == len(nodes)
    assert result["visited_count"] > 0
    assert result["elapsed_ms"] < 100, (
        f"benchmark de {len(nodes)} nós levou {result['elapsed_ms']}ms — "
        "fila pode ter voltado a O(n^2) (list.pop(0))"
    )
