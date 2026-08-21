"""Jornada HTTP cobrindo ferramentas da plataforma (auth → analyze → gov → embed)."""

from __future__ import annotations


def test_user_journey_all_tool_surfaces(client, no_omniroute):
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "journey@test.com",
            "username": "journey",
            "password": "JourneyPass1",
            "phone": "+5511999990000",
            "birth_date": "1990-01-01",
        },
    )
    assert reg.status_code == 200, reg.text

    login = client.post(
        "/api/v1/auth/login",
        json={"username": "journey", "password": "JourneyPass1"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/sso/config").status_code == 200

    proj = client.post("/api/v1/projects", json={"name": "Journey Proj", "context": "e2e"})
    assert proj.status_code == 201, proj.text
    pid = proj.json()["id"]
    assert client.get(f"/api/v1/projects/{pid}/diagrams").status_code == 200

    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Journey Graph",
            "nodes": [
                {
                    "id": "n1",
                    "type": "arch",
                    "position": {"x": 0, "y": 0},
                    "data": {"kind": "backend", "label": "API", "catalogId": "be-fastapi"},
                },
                {
                    "id": "n2",
                    "type": "arch",
                    "position": {"x": 200, "y": 0},
                    "data": {"kind": "database", "label": "PG", "catalogId": "db-postgres"},
                },
            ],
            "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
        },
    )
    assert graph.status_code == 201, graph.text
    gid = graph.json()["id"]

    assert client.post(f"/api/v1/graphs/{gid}/analyze").status_code == 200
    assert (
        client.post(
            "/api/v1/analyze/heuristic",
            json={"name": "h", "nodes": [], "edges": []},
        ).status_code
        == 200
    )

    assert client.post(f"/api/v1/graphs/{gid}/failure-injection", json={"node_id": "n1"}).status_code == 200
    assert client.post(f"/api/v1/graphs/{gid}/blast-radius", json={"node_id": "n1"}).status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/circuit-breakers").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/cost-estimate").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/doc").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/network-policy").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/deployment-flows").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/polyglot-map").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/lineage").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/capacity-estimate").status_code == 200

    assert client.post(f"/api/v1/graphs/{gid}/access", json={"team": "platform", "role": "write"}).status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/access").status_code == 200
    assert (
        client.post(
            f"/api/v1/graphs/{gid}/boundary-contracts",
            json={"source_zone": "api", "target_zone": "db", "protocol": "tcp"},
        ).status_code
        == 200
    )

    assert (
        client.post(
            f"/api/v1/graphs/{gid}/comments",
            json={"text": "nota da jornada", "node_id": "n1"},
            headers=headers,
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/graphs/{gid}/comments").status_code == 200
    assert client.get(f"/api/v1/audit/{gid}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/audit/{gid}/count", headers=headers).status_code == 200
    assert client.get(f"/api/v1/embed/{gid}").status_code == 200
    assert client.get(f"/api/v1/embed/{gid}/token").status_code == 200

    assert (
        client.post(
            "/api/v1/catalog/private/",
            json={
                "id": "priv-journey-1",
                "label": "InternalSvc",
                "kind": "backend",
                "tech": "Custom",
                "description": "svc interno",
            },
            headers=headers,
        ).status_code
        == 200
    )
    assert client.get("/api/v1/catalog/private/", headers=headers).status_code == 200

    assert client.get(f"/api/v1/projects/{pid}/consistency").status_code == 200
    assert client.get(f"/api/v1/projects/{pid}/policy").status_code == 200
    assert client.get(f"/api/v1/projects/{pid}/raci").status_code == 200
    assert client.get(f"/api/v1/graphs/{gid}/slo").status_code == 200
    assert client.post(f"/api/v1/graphs/{gid}/benchmark").status_code == 200
    assert (
        client.post(
            f"/api/v1/projects/{pid}/adrs/export",
            json={
                "adrs": [
                    {
                        "id": "ADR-001",
                        "title": "Usar FastAPI",
                        "status": "accepted",
                        "context": "API",
                        "decision": "FastAPI",
                        "consequences": "async",
                    }
                ]
            },
        ).status_code
        == 200
    )

    assert client.get("/api/v1/simulations/presets").status_code == 200
    assert client.get("/api/v1/settings/ai").status_code == 200
    assert client.get("/api/health").status_code == 200
