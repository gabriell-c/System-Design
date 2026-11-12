"""Testes P0.5 — failure injection, blast radius, circuit breakers, cost model, wiki."""

import contextlib
import uuid

from fastapi.testclient import TestClient

from app.main import app
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


# ---------------------------------------------------------------------------
# Camada de API (S2) — IDOR (ownership), Literais de mode, nó inexistente,
# rate limit 30/60s e 401 anônimo.
# ---------------------------------------------------------------------------

_OTHER_USER_PASSWORD = "SecurePass1"
_OTHER_USER_BIRTH = "1990-01-01"


@contextlib.contextmanager
def _other_user_session():
    """Segundo usuário (não-dono) num TestClient próprio — padrão P1.2
    (mesmo shape de tests/test_p1_security.py::_user_session)."""
    username = f"u{uuid.uuid4().hex[:8]}"
    client = TestClient(app)
    with client:
        reg = client.post(
            "/api/v1/auth/register",
            json={
                "username": username,
                "email": f"{username}@archia.test",
                "password": _OTHER_USER_PASSWORD,
                "phone": "+5511900001111",
                "birth_date": _OTHER_USER_BIRTH,
            },
        )
        assert reg.status_code in (200, 201), reg.text
        login = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": _OTHER_USER_PASSWORD},
        )
        assert login.status_code == 200, login.text
        yield client


def _resilience_graph_id(client) -> str:
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "R2", "nodes": _chain_graph()[0], "edges": _chain_graph()[1]},
    ).json()
    return graph["id"]


def test_resilience_anonymous_401(anonymous_client):
    gid = uuid.uuid4().hex[:36]
    assert anonymous_client.post(f"/api/v1/graphs/{gid}/failure-injection", json={"node_id": "api"}).status_code == 401
    assert anonymous_client.post(f"/api/v1/graphs/{gid}/blast-radius", json={"node_id": "api"}).status_code == 401
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/circuit-breakers").status_code == 401
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/cost-estimate").status_code == 401
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/doc").status_code == 401


def test_resilience_cross_user_404_idor(client):
    """PROVA do bug antigo (item 1): antes, `db.get(Graph, graph_id)` sem
    ownership — qualquer user logado injetava/fazia blast no grafo de
    outrem. Agora: grafo do A, chamada como B → 404 (não 200)."""
    gid = _resilience_graph_id(client)
    with _other_user_session() as other:
        assert other.post(f"/api/v1/graphs/{gid}/failure-injection", json={"node_id": "api"}).status_code == 404
        assert other.post(f"/api/v1/graphs/{gid}/blast-radius", json={"node_id": "api"}).status_code == 404
        assert other.get(f"/api/v1/graphs/{gid}/circuit-breakers").status_code == 404
        assert other.get(f"/api/v1/graphs/{gid}/cost-estimate").status_code == 404
        assert other.get(f"/api/v1/graphs/{gid}/doc").status_code == 404
    # O dono continua com acesso (não quebrou o caso legítimo).
    assert client.post(f"/api/v1/graphs/{gid}/failure-injection", json={"node_id": "api"}).status_code == 200


def test_failure_injection_invalid_mode_422(client):
    gid = _resilience_graph_id(client)
    resp = client.post(f"/api/v1/graphs/{gid}/failure-injection", json={"node_id": "api", "mode": "corrupt"})
    assert resp.status_code == 422


def test_failure_injection_unknown_node_422(client):
    """Item 5: nó inexistente → 422 na rota (antes: HTTP 200 {ok:false})."""
    gid = _resilience_graph_id(client)
    resp = client.post(f"/api/v1/graphs/{gid}/failure-injection", json={"node_id": "ghost"})
    assert resp.status_code == 422
    assert "não existe no grafo" in resp.json()["detail"]
    resp = client.post(f"/api/v1/graphs/{gid}/blast-radius", json={"node_id": "ghost"})
    assert resp.status_code == 422


def test_resilience_rate_limit_429(client):
    """Item 12: 30/60s por usuário — a 31ª chamada cai em 429 c/ Retry-After."""
    gid = _resilience_graph_id(client)
    for _ in range(30):
        assert client.get(f"/api/v1/graphs/{gid}/circuit-breakers").status_code == 200
    third = client.get(f"/api/v1/graphs/{gid}/circuit-breakers")
    assert third.status_code == 429
    assert third.headers.get("retry-after") == "60"
