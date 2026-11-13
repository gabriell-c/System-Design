"""R2 — rota própria de threat heurístico (`app/routes/threat.py`, tag "threat").

Cobre o contrato (b): GET 200 com shape exato (+ negative asserts), POST live
200 (usa o CANVAS do body, não o grafo salvo), 422 pt-BR (item de
nodes/edges não-dict; nfr não-dict), IDOR 404 (GET e POST live em grafo
alheio), 401 anônimo nos dois endpoints, 429 + Retry-After (limiter
`threat` 60/60s, bucket separado do `network:`), e tag "threat" no OpenAPI.

Fixtures de nó são custom (sem catalogId) para caírem só no fallback
label+tech — nenhum cap disparado: `API Gateway` (envoy) é "externo" via
EXTERNAL_KEYS e não fornece waf/identity/audit/kms/tls.
"""

import contextlib
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.routes.threat import THREAT_VERSION, ThreatAnalysisOut

# ---------------------------------------------------------------------------
# Shape do contrato (b) — chaves exatas + negative asserts.
# ---------------------------------------------------------------------------

THREAT_TOP_KEYS = set(ThreatAnalysisOut.model_fields.keys())
SEVERITY_KEYS = {"critical", "warning", "info"}
FINDING_KEYS = {"node_id", "severity", "title", "detail", "metric", "fix_action", "evidence_node_ids", "agent", "model"}


def _assert_threat_shape(payload: dict) -> None:
    assert set(payload.keys()) == THREAT_TOP_KEYS
    # Negative asserts: nada do shape de outros endpoints vazou.
    assert "ok" not in payload and "score" not in payload and "agents" not in payload
    assert payload["version"] == THREAT_VERSION == "threat-v2"
    assert set(payload["by_severity"].keys()) == SEVERITY_KEYS
    assert payload["total"] == len(payload["findings"])
    assert sum(payload["by_severity"].values()) == payload["total"]
    assert isinstance(payload["summary"], str) and payload["summary"]
    for finding in payload["findings"]:
        assert set(finding.keys()) == FINDING_KEYS
        # R4f: todo finding heurístico carrega model (nada de None).
        assert finding["model"] in {"stride", "linddun"}
        assert finding["severity"] in SEVERITY_KEYS
        assert finding["metric"] is None


# ---------------------------------------------------------------------------
# Canvas do grafo salvo (GET) — dispara 5 findings determinísticos:
# Spoofing (critical), Tampering (warning), Info Disclosure (critical, PII
# sem KMS), DoS (warning) [stride] + Detail Exposure (warning) [linddun].
# ---------------------------------------------------------------------------

SAVED_NODES = [
    {"id": "gw", "data": {"kind": "service", "label": "API Gateway", "tech": "envoy"}},
    {"id": "db", "data": {"kind": "database", "label": "Customer DB", "tech": "postgres", "piiSensitivity": "high"}},
]
SAVED_EDGES = [{"id": "e1", "source": "gw", "target": "db"}]

# Canvas live (menor, diferente do salvo) — só Tampering dispara (1 finding).
LIVE_NODES = [{"id": "w1", "data": {"kind": "service", "label": "Worker", "tech": "python"}}]


def _create_graph(client: TestClient) -> str:
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Threat", "nodes": SAVED_NODES, "edges": SAVED_EDGES},
    ).json()
    return graph["id"]


# ---------------------------------------------------------------------------
# 2º usuário (não-dono) — mesmo padrão de tests/test_cost_routes.py.
# ---------------------------------------------------------------------------

_OTHER_USER_PASSWORD = "SecurePass9"
_OTHER_USER_BIRTH = "1990-03-03"


@contextlib.contextmanager
def _other_user_session():
    username = f"u{uuid.uuid4().hex[:8]}"
    client = TestClient(app)
    with client:
        reg = client.post(
            "/api/v1/auth/register",
            json={
                "username": username,
                "email": f"{username}@archia.test",
                "password": _OTHER_USER_PASSWORD,
                "phone": "+5511900004444",
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


# ---------------------------------------------------------------------------
# GET /graphs/{id}/threat-analysis — shape exato do grafo salvo.
# ---------------------------------------------------------------------------


def test_threat_get_200_shape(client):
    gid = _create_graph(client)
    resp = client.get(f"/api/v1/graphs/{gid}/threat-analysis")
    assert resp.status_code == 200
    payload = resp.json()
    _assert_threat_shape(payload)
    assert payload["total"] == 5
    assert payload["by_severity"] == {"critical": 2, "warning": 3, "info": 0}
    titles = {f["title"] for f in payload["findings"]}
    assert any(t.startswith("Spoofing") for t in titles)
    assert any(t.startswith("Tampering") for t in titles)
    assert any(t.startswith("Info Disclosure") for t in titles)


def test_threat_get_empty_canvas_zero_findings(client):
    gid = client.post("/api/v1/graphs", json={"name": "Vazio", "nodes": [], "edges": []}).json()["id"]
    payload = client.get(f"/api/v1/graphs/{gid}/threat-analysis").json()
    assert payload["total"] == 0
    assert payload["findings"] == []
    assert payload["by_severity"] == {"critical": 0, "warning": 0, "info": 0}
    # Empty state honesto (R7 consome esta mensagem).
    assert "Nenhum check heurístico" in payload["summary"]


# ---------------------------------------------------------------------------
# POST /graphs/{id}/threat-analysis/live — canvas na mão (preview sem salvar).
# ---------------------------------------------------------------------------


def test_threat_post_live_200_uses_canvas_not_saved(client):
    gid = _create_graph(client)
    saved = client.get(f"/api/v1/graphs/{gid}/threat-analysis").json()
    assert saved["total"] == 5
    live = client.post(
        f"/api/v1/graphs/{gid}/threat-analysis/live",
        json={"nodes": LIVE_NODES, "edges": []},
    )
    assert live.status_code == 200
    payload = live.json()
    _assert_threat_shape(payload)
    # Canvas live (1 card, sem PII/externo) → só Tampering dispara.
    assert payload["total"] == 1
    assert payload["total"] != saved["total"]
    assert payload["findings"][0]["title"].startswith("Tampering")
    assert payload["findings"][0]["model"] == "stride"
    # Grafo salvo não foi mutado pelo live (preview é efêmero).
    assert client.get(f"/api/v1/graphs/{gid}/threat-analysis").json()["total"] == 5


def test_threat_post_live_empty_body(client):
    gid = _create_graph(client)
    payload = client.post(f"/api/v1/graphs/{gid}/threat-analysis/live", json={}).json()
    assert payload["total"] == 0
    assert payload["findings"] == []


def test_threat_post_live_422_non_dict_items(client):
    gid = _create_graph(client)
    url = f"/api/v1/graphs/{gid}/threat-analysis/live"
    # `nodes`/`edges` não são lista (Pydantic) → 422.
    assert client.post(url, json={"nodes": {"id": "x"}}).status_code == 422
    assert client.post(url, json={"nodes": [], "edges": "oops"}).status_code == 422
    # Item não-dict em `nodes` (handler) → 422 pt-BR.
    resp = client.post(url, json={"nodes": [1]})
    assert resp.status_code == 422
    assert resp.json()["detail"] == "'nodes' só aceita lista de objetos"
    # Item não-dict em `edges` (handler) → 422 pt-BR.
    resp = client.post(url, json={"nodes": [], "edges": ["e1"]})
    assert resp.status_code == 422
    assert resp.json()["detail"] == "'edges' só aceita lista de objetos"
    # `nfr` não-dict (lista, string) → 422 pt-BR; ausente ou {} → ok.
    resp = client.post(url, json={"nodes": [], "nfr": ["gdpr"]})
    assert resp.status_code == 422
    assert resp.json()["detail"] == "'nfr' deve ser um objeto (ou ausente)"
    assert client.post(url, json={"nodes": [], "nfr": "oops"}).status_code == 422
    assert client.post(url, json={"nodes": [], "nfr": {}}).status_code == 200


# ---------------------------------------------------------------------------
# IDOR (R1): grafo alheio → 404 nos dois endpoints, mesmo com body válido.
# ---------------------------------------------------------------------------


def test_threat_cross_user_404_idor(client):
    gid = _create_graph(client)
    with _other_user_session() as other:
        assert other.get(f"/api/v1/graphs/{gid}/threat-analysis").status_code == 404
        assert other.post(f"/api/v1/graphs/{gid}/threat-analysis/live", json={"nodes": []}).status_code == 404
    # O dono continua com acesso.
    assert client.get(f"/api/v1/graphs/{gid}/threat-analysis").status_code == 200


# ---------------------------------------------------------------------------
# 401 anônimo
# ---------------------------------------------------------------------------


def test_threat_anonymous_401(anonymous_client):
    gid = uuid.uuid4().hex[:36]
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/threat-analysis").status_code == 401
    assert anonymous_client.post(f"/api/v1/graphs/{gid}/threat-analysis/live", json={"nodes": []}).status_code == 401


# ---------------------------------------------------------------------------
# 429 + Retry-After — limiter `threat` 60/60s, bucket separado do `network:`.
# ---------------------------------------------------------------------------


def test_threat_rate_limit_429_separate_bucket(client):
    gid = _create_graph(client)
    url = f"/api/v1/graphs/{gid}/threat-analysis"
    for _ in range(60):
        assert client.get(url).status_code == 200
    denied = client.get(url)
    assert denied.status_code == 429
    assert denied.headers.get("retry-after") == "60"
    assert denied.json()["detail"].startswith("Too many attempts")
    # Bucket `network:` é independente — threat exaurido não afeta rede.
    assert client.get(f"/api/v1/graphs/{gid}/network-policy").status_code == 200


# ---------------------------------------------------------------------------
# Tag OpenAPI: a rota vive no router "threat" (R2).
# ---------------------------------------------------------------------------


def test_threat_openapi_tags():
    spec = app.openapi()
    get = spec["paths"]["/api/v1/graphs/{graph_id}/threat-analysis"]["get"]
    assert "threat" in get["tags"]
    live = spec["paths"]["/api/v1/graphs/{graph_id}/threat-analysis/live"]["post"]
    assert "threat" in live["tags"]
    # Schema da resposta travado no OpenAPI (contrato b).
    out = spec["components"]["schemas"]["ThreatAnalysisOut"]
    assert set(out["properties"].keys()) == THREAT_TOP_KEYS
