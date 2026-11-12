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


def _run_payload(**overrides) -> dict:
    base = {"nodes": SAMPLE_NODES, "edges": SAMPLE_EDGES}
    base.update(overrides)
    return base


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


# ---------------------------------------------------------------------------
# Camada de API (S2) — auth, rate limit, validação de Literais, teto 413,
# cenários re-executáveis (POST /graphs/{id}/simulation-scenarios/{sid}/run).
# ---------------------------------------------------------------------------

import contextlib
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.graph import SimulationScenario
from app.schemas.simulation import SimulationResult

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


def _make_graph(client, name="Sim") -> str:
    graph = client.post("/api/v1/graphs", json={"name": name, "nodes": SAMPLE_NODES, "edges": SAMPLE_EDGES}).json()
    return graph["id"]


def _make_scenario(client, graph_id: str, payload: dict, name="Teste") -> str:
    resp = client.post(
        f"/api/v1/graphs/{graph_id}/simulation-scenarios",
        json={"name": name, "payload": payload},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def _mock_engine(monkeypatch, captured: list, module: str = "app.routes.insights") -> None:
    """Engine determinístico: o run de cenário é mock do service (contrato b) —
    a rota reconstrói a request; o engine só é verificado por S1a."""

    import importlib

    mod = importlib.import_module(module)

    def fake_run(req):
        captured.append(req)
        return SimulationResult(
            seed=req.seed,
            realism_score=0.7,
            estimated_capacity_rps=100.0,
            summary="mock-determinístico",
            reproducible=True,
        )

    monkeypatch.setattr(mod, "run_simulation", fake_run)


def test_run_requires_auth(anonymous_client):
    assert anonymous_client.post("/api/v1/simulations/run", json=_run_payload()).status_code == 401
    assert anonymous_client.get("/api/v1/simulations/presets").status_code == 401


def test_run_rate_limit_429_on_sixth_request(client, monkeypatch):
    """Item 11: 5/60s por usuário → 429 no 6º, com Retry-After.
    Engine mockado: valida a CAMADA de rota/rate-limit, independente do
    estado in-flight do engine (S1a)."""
    _mock_engine(monkeypatch, [], module="app.routes.simulations")
    for i in range(5):
        resp = client.post("/api/v1/simulations/run", json=_run_payload(seed=i))
        assert resp.status_code == 200, resp.text
    sixth = client.post("/api/v1/simulations/run", json=_run_payload())
    assert sixth.status_code == 429
    assert sixth.headers.get("retry-after") == "60"  # item 11 — Retry-After no 429


def test_run_422_invalid_fields(client):
    assert client.post("/api/v1/simulations/run", json=_run_payload(seed=-1)).status_code == 422
    assert client.post("/api/v1/simulations/run", json=_run_payload(realism_level=1.5)).status_code == 422


def test_run_preset_422_invalid_literals(client, monkeypatch):
    """422s são da validação Pydantic (rodam antes do engine); só o caso
    válido precisa do engine → mockado (estado in-flight do S1a não afeta)."""
    _mock_engine(monkeypatch, [], module="app.routes.simulations")
    base = {"preset_id": "steady-saas", "nodes": SAMPLE_NODES, "edges": SAMPLE_EDGES}
    # Item 3: test_mode/output_format são Literais agora (422, não 500).
    assert client.post("/api/v1/simulations/run-preset", json={**base, "test_mode": "banana"}).status_code == 422
    assert client.post("/api/v1/simulations/run-preset", json={**base, "output_format": "xml"}).status_code == 422
    # Item 9: whitelist de métricas — "banana" não é métrica conhecida.
    bad_rules = {**base, "validation_rules": [{"metric": "banana"}]}
    assert client.post("/api/v1/simulations/run-preset", json=bad_rules).status_code == 422
    good_rules = {**base, "validation_rules": [{"metric": "capacity_rps", "min_value": 10}]}
    assert client.post("/api/v1/simulations/run-preset", json=good_rules).status_code == 200


def test_run_413_graph_cap(client):
    big_nodes = [{"id": f"n{i}", "data": {"kind": "backend", "label": f"N{i}"}} for i in range(401)]
    resp = client.post("/api/v1/simulations/run", json={"nodes": big_nodes, "edges": []})
    assert resp.status_code == 413
    assert "teto 400" in resp.json()["detail"]
    many_edges = [{"source": "b1", "target": "d1"} for _ in range(801)]
    resp = client.post("/api/v1/simulations/run", json={"nodes": SAMPLE_NODES, "edges": many_edges})
    assert resp.status_code == 413
    assert "teto 800" in resp.json()["detail"]


def test_scenario_run_200_reproducible(client, monkeypatch):
    """Item 8: cenário salvo roda contra os nodes/edges do GRAFO (DB),
    preset resolvido via list_presets — e re-executar dá o mesmo resultado."""
    captured: list = []
    _mock_engine(monkeypatch, captured)
    gid = _make_graph(client)
    sid = _make_scenario(client, gid, {"preset_id": "steady-saas", "seed": 7})

    r1 = client.post(f"/api/v1/graphs/{gid}/simulation-scenarios/{sid}/run")
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["seed"] == 7
    assert body["presets_used"] == ["steady-saas"]
    assert [n["id"] for n in captured[0].nodes] == ["b1", "d1", "c1"]  # grafo do DB, não do payload
    assert captured[0].load is not None and captured[0].load.type == "constant"

    r2 = client.post(f"/api/v1/graphs/{gid}/simulation-scenarios/{sid}/run")
    assert r2.status_code == 200
    assert r2.json() == body  # re-executável: mesmo payload → mesmo resultado


def test_scenario_run_direct_request_without_preset(client, monkeypatch):
    captured: list = []
    _mock_engine(monkeypatch, captured)
    gid = _make_graph(client)
    sid = _make_scenario(client, gid, {"seed": 3, "test_mode": "stress"})
    resp = client.post(f"/api/v1/graphs/{gid}/simulation-scenarios/{sid}/run")
    assert resp.status_code == 200
    assert resp.json()["presets_used"] == []
    assert captured[0].test_mode == "stress"


def test_scenario_run_cross_user_404(client, monkeypatch):
    """Item 8/1: ownership — cenário do usuário A, chamado pelo B → 404."""
    captured: list = []
    _mock_engine(monkeypatch, captured)
    gid = _make_graph(client)
    sid = _make_scenario(client, gid, {"seed": 5})
    with _other_user_session() as other:
        resp = other.post(f"/api/v1/graphs/{gid}/simulation-scenarios/{sid}/run")
        assert resp.status_code == 404


def test_scenario_run_invalid_payload_422(client, monkeypatch):
    """Item 8: payload tipado inválido persistido → 422 (não 500)."""
    captured: list = []
    _mock_engine(monkeypatch, captured)
    gid = _make_graph(client)
    sid = _make_scenario(client, gid, {"seed": 5})
    with SessionLocal() as db:
        row = db.get(SimulationScenario, sid)
        row.payload_json = '{"test_mode": "banana"}'
        db.commit()
    resp = client.post(f"/api/v1/graphs/{gid}/simulation-scenarios/{sid}/run")
    assert resp.status_code == 422
    assert "inválido" in resp.json()["detail"].lower()


def test_scenario_create_name_and_payload_rules(client):
    gid = _make_graph(client)
    # (i) nome acima de 200 → 422 no schema (DB é String(200)).
    long_name = client.post(
        f"/api/v1/graphs/{gid}/simulation-scenarios",
        json={"name": "x" * 201, "payload": {}},
    )
    assert long_name.status_code == 422
    # payload legado free-form continua válido (permissivo, item 8-ii).
    # Ruling: persistência NORMALIZADA (model_dump) — chaves extra do legado
    # são mantidas e os campos tipados ganham defaults materializados,
    # entregando shape estável para o front (S3b).
    legacy = client.post(
        f"/api/v1/graphs/{gid}/simulation-scenarios",
        json={"name": "Legado", "payload": {"scenario": "node_failure", "custom": 1}},
    )
    assert legacy.status_code in (200, 201), legacy.text
    listed = client.get(f"/api/v1/graphs/{gid}/simulation-scenarios").json()
    stored = next(s for s in listed if s["name"] == "Legado")
    assert stored["payload"]["scenario"] == "node_failure"
    assert stored["payload"]["custom"] == 1  # chave extra preservada
    assert stored["payload"]["seed"] == 42  # default tipado materializado
