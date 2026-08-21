SAMPLE_NODES = [
    {
        "id": "b1",
        "data": {"kind": "backend", "label": "API", "catalogId": "be-fastapi", "config": {"framework": "FastAPI"}},
    },
    {
        "id": "d1",
        "data": {"kind": "database", "label": "DB", "catalogId": "db-pg", "config": {"engine": "PostgreSQL"}},
    },
    {
        "id": "c1",
        "data": {"kind": "cloud", "label": "Redis", "catalogId": "cloud-redis", "config": {"service": "Redis"}},
    },
]

SAMPLE_EDGES = [{"source": "b1", "target": "d1"}, {"source": "b1", "target": "c1"}]


def test_list_presets(client):
    response = client.get("/api/v1/simulations/presets")
    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 3
    ids = {p["id"] for p in body}
    assert "black-friday-spike" in ids
    assert "gradual-ramp" in ids


def test_run_simulation_empty_graph(client):
    response = client.post(
        "/api/v1/simulations/run",
        json={"nodes": [], "edges": [], "seed": 1},
    )
    assert response.status_code == 400


def test_run_simulation_reproducible(client):
    payload = {
        "nodes": SAMPLE_NODES,
        "edges": SAMPLE_EDGES,
        "seed": 99,
        "realism_level": 0.7,
        "load": {
            "name": "t",
            "type": "spike",
            "requests_per_second": 400,
            "duration_seconds": 60,
            "burst_multiplier": 5,
            "concurrent_users": 500,
        },
        "events": [
            {
                "event_type": "payment_gateway_timeout",
                "trigger_probability": 0.4,
                "cascade_enabled": True,
                "dependent_events": ["retry_storm"],
                "severity": "critical",
            }
        ],
        "include_timeline": True,
        "output_format": "json",
    }
    a = client.post("/api/v1/simulations/run", json=payload)
    b = client.post("/api/v1/simulations/run", json=payload)
    assert a.status_code == 200
    assert b.status_code == 200
    ja, jb = a.json(), b.json()
    assert ja["seed"] == jb["seed"] == 99
    assert ja["estimated_capacity_rps"] == jb["estimated_capacity_rps"]
    assert ja["realism_score"] == jb["realism_score"]
    assert ja["load"]["peak_rps"] == jb["load"]["peak_rps"]
    assert ja["journey"]["conversion_rate"] == jb["journey"]["conversion_rate"]
    assert len(ja["load"]["timeline"]) > 0
    assert "validations" in ja
    assert ja["reproducible"] is True


def test_run_preset(client):
    response = client.post(
        "/api/v1/simulations/run-preset",
        json={
            "preset_id": "steady-saas",
            "nodes": SAMPLE_NODES,
            "edges": SAMPLE_EDGES,
            "seed": 7,
            "realism_level": 0.5,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["presets_used"] == ["steady-saas"]
    assert body["load"]["type"] == "constant"
    assert body["journey"] is not None


def test_run_preset_unknown(client):
    response = client.post(
        "/api/v1/simulations/run-preset",
        json={"preset_id": "nope", "nodes": SAMPLE_NODES, "edges": [], "seed": 1},
    )
    assert response.status_code == 404


def test_export_prometheus(client):
    response = client.post(
        "/api/v1/simulations/run",
        json={
            "nodes": SAMPLE_NODES,
            "edges": SAMPLE_EDGES,
            "seed": 3,
            "output_format": "prometheus",
        },
    )
    assert response.status_code == 200
    assert "archia_sim_capacity_rps" in response.text
    assert response.headers.get("x-archia-seed") == "3"


def test_export_csv(client):
    response = client.post(
        "/api/v1/simulations/run-preset",
        json={
            "preset_id": "gradual-ramp",
            "nodes": SAMPLE_NODES,
            "edges": SAMPLE_EDGES,
            "seed": 11,
            "output_format": "csv",
        },
    )
    assert response.status_code == 200
    assert "capacity_rps" in response.text
    assert "text/csv" in response.headers.get("content-type", "")


def test_service_unit_capacity():
    from app.schemas.simulation import SimulationRequest
    from app.services.simulation import estimate_component_capacities, run_simulation

    cap, comps, bots = estimate_component_capacities(SAMPLE_NODES, SAMPLE_EDGES)
    # Capacity should be reasonable (>= 20 RPS)
    assert cap >= 20
    assert isinstance(bots, list)
    assert isinstance(comps, list)
    assert len(comps) >= 2  # pelo menos backend e db

    r1 = run_simulation(SimulationRequest(nodes=SAMPLE_NODES, edges=SAMPLE_EDGES, seed=42))
    r2 = run_simulation(SimulationRequest(nodes=SAMPLE_NODES, edges=SAMPLE_EDGES, seed=42))
    assert r1.model_dump() == r2.model_dump()
    r3 = run_simulation(SimulationRequest(nodes=SAMPLE_NODES, edges=SAMPLE_EDGES, seed=43))
    assert r3.load.peak_rps != r1.load.peak_rps or r3.realism_score != r1.realism_score or r3.journey.conversion_rate != r1.journey.conversion_rate

    # Testa engineering_audit
    assert r1.engineering_audit is not None
    assert r1.engineering_audit.system_capacity_rps > 0
    assert r1.engineering_audit.headroom_pct >= 0
