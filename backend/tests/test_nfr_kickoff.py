from app.schemas.graph import ProjectNfr


def test_create_graph_with_nfr(client):
    response = client.post(
        "/api/v1/graphs",
        json={
            "name": "Com NFR",
            "context": "Produto teste com escala definida.",
            "nfr": {
                "users_per_day": 2000,
                "budget_usd_month": 120,
                "availability_pct": 99.5,
                "latency_p99_ms": 300,
                "compliance": ["LGPD"],
                "team_size": 3,
                "deadline_weeks": 10,
                "environments": {
                    "has_dev": True,
                    "has_staging": True,
                    "has_prod": True,
                    "has_ci_cd": True,
                    "has_backups": True,
                    "has_monitoring_plan": False,
                },
            },
            "nodes": [
                {
                    "id": "b1",
                    "data": {
                        "kind": "backend",
                        "label": "API",
                        "catalogId": "be-fastapi",
                        "config": {"framework": "FastAPI"},
                    },
                }
            ],
            "edges": [],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["nfr"]["users_per_day"] == 2000
    assert "LGPD" in body["nfr"]["compliance"]
    assert body["nfr"]["environments"]["has_staging"] is True

    again = client.get(f"/api/v1/graphs/{body['id']}")
    assert again.status_code == 200
    assert again.json()["nfr"]["budget_usd_month"] == 120


def test_heuristic_flags_missing_identity(client):
    response = client.post(
        "/api/v1/analyze/heuristic",
        json={
            "name": "sem auth",
            "nodes": [
                {
                    "id": "1",
                    "data": {"kind": "backend", "label": "API", "config": {"framework": "FastAPI"}},
                },
                {
                    "id": "2",
                    "data": {"kind": "database", "label": "PG", "config": {"engine": "PostgreSQL"}},
                },
            ],
            "edges": [],
        },
    )
    assert response.status_code == 200
    body = response.json()
    titles = [f["title"] for f in body["findings"]]
    assert any("Auth" in t or "auth" in t.lower() for t in titles)


def test_project_nfr_defaults():
    nfr = ProjectNfr()
    assert nfr.environments.has_dev is True
    assert nfr.compliance == []
