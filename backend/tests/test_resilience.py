"""Testes P0.5 — failure injection, blast radius, circuit breakers, cost model, wiki."""

from app.services.blast_radius import compute_blast_radius
from app.services.circuit_breaker import analyze_circuit_breakers
from app.services.cost_model import estimate_cost_breakdown
from app.services.failure_injection import inject_failure
from app.services.live_doc import build_live_doc


def _chain_graph():
    nodes = [
        {"id": "api", "data": {"kind": "backend", "label": "API", "tech": "FastAPI", "catalogId": "be-fastapi"}},
        {"id": "db", "data": {"kind": "database", "label": "DB", "tech": "PostgreSQL", "catalogId": "db-postgres"}},
        {"id": "cache", "data": {"kind": "database", "label": "Cache", "tech": "Redis", "catalogId": "db-redis"}},
    ]
    edges = [
        {"id": "e1", "source": "api", "target": "db", "data": {"flowKind": "data", "isCriticalPath": True}},
        {"id": "e2", "source": "api", "target": "cache", "data": {"flowKind": "data", "failureBehavior": "fallback"}},
    ]
    return nodes, edges


def test_failure_injection_downstream():
    nodes, edges = _chain_graph()
    result = inject_failure(nodes, edges, "api", mode="down")
    assert result["ok"] is True
    assert "api" in result["unreachable_node_ids"]
    assert "db" in result["unreachable_node_ids"]
    assert "cache" in result["degraded_node_ids"]
    assert result["journeys_broken_pct"] > 0


def test_blast_radius_highlights_edges():
    nodes, edges = _chain_graph()
    result = compute_blast_radius(nodes, edges, "api")
    assert result["ok"] is True
    assert len(result["highlight_edge_ids"]) >= 1
    assert result["journeys_broken_pct"] > 0


def test_circuit_breaker_analysis():
    nodes, edges = _chain_graph()
    nodes.append(
        {
            "id": "cb1",
            "data": {
                "kind": "security",
                "label": "Breaker",
                "catalogId": "pat-circuit-breaker",
                "circuitBreaker": {"failure_threshold": 3, "window_seconds": 30, "state": "closed"},
            },
        }
    )
    result = analyze_circuit_breakers(nodes, edges)
    assert result["breaker_count"] >= 2
    assert isinstance(result["gaps"], list)


def test_cost_model_breakdown():
    nodes, edges = _chain_graph()
    result = estimate_cost_breakdown(nodes, edges)
    assert result["node_count"] == 3
    assert result["total_usd_month"] > 0
    assert len(result["line_items"]) == 3


def test_live_doc_anchors():
    nodes, edges = _chain_graph()
    doc = build_live_doc("Test", nodes, edges, context="ctx", nfr={"users_per_day": 1000})
    assert "node-api" in doc["markdown"]
    assert doc["anchors"]["api"] == "node-api"


def test_resilience_routes(client):
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Resilience",
            "nodes": _chain_graph()[0],
            "edges": _chain_graph()[1],
        },
    ).json()
    gid = graph["id"]

    inj = client.post(
        f"/api/v1/graphs/{gid}/failure-injection",
        json={"node_id": "api", "mode": "down"},
    )
    assert inj.status_code == 200
    assert inj.json()["ok"] is True

    blast = client.post(
        f"/api/v1/graphs/{gid}/blast-radius",
        json={"node_id": "api", "mode": "down"},
    )
    assert blast.status_code == 200
    assert blast.json()["ok"] is True

    cb = client.get(f"/api/v1/graphs/{gid}/circuit-breakers")
    assert cb.status_code == 200
    assert "breakers" in cb.json()

    cost = client.get(f"/api/v1/graphs/{gid}/cost-estimate")
    assert cost.status_code == 200
    assert cost.json()["total_usd_month"] > 0

    doc = client.get(f"/api/v1/graphs/{gid}/doc")
    assert doc.status_code == 200
    assert "markdown" in doc.json()
