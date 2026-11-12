"""R5 — rota própria de custo (`app/routes/cost.py`, tag "cost").

Cobre: GET 200 com o shape novo (SEM tier/by_tier/heuristic_total_usd_month,
COM priced/priced_count/price_table_version), POST live 200 (canvas na mão,
grafo alheio → 404), POST live 422 (body fora do contrato), 401 anônimo nos
dois endpoints, 429 + Retry-After (limiter `cost` separado do de resiliência),
e tag OpenAPI (o path saiu do router "resilience" e vive em "cost").
"""

import contextlib
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services.pricing import PRICE_TABLE_VERSION

# ---------------------------------------------------------------------------
# Shape do contrato (b) — chaves exatas. R2: `tier`/`by_tier`/
# `heuristic_total_usd_month` SAÍRAM do wire; R4: `priced`/`priced_count`
# entraram.
# ---------------------------------------------------------------------------

COST_TOP_LEVEL_KEYS = {
    "line_items",
    "total_usd_month",
    "by_region",
    "node_count",
    "priced_count",
    "price_table_version",
    "summary",
}
LINE_ITEM_KEYS = {
    "node_id",
    "label",
    "catalog_id",
    "region",
    "cost_key",
    "cost_usd_month",
    "priced",
}


def _assert_cost_shape(payload: dict) -> None:
    assert set(payload.keys()) == COST_TOP_LEVEL_KEYS
    assert "tier" not in payload and "by_tier" not in payload
    assert "heuristic_total_usd_month" not in payload
    assert payload["price_table_version"] == PRICE_TABLE_VERSION
    for item in payload["line_items"]:
        assert set(item.keys()) == LINE_ITEM_KEYS
        assert "tier" not in item


def _chain_nodes() -> list[dict]:
    # R1: db-postgres → 13.00, db-redis → 12.00, be-fastapi → "code" 0.00
    # (custo zero conhecido) → total 25.00, tudo priced.
    return [
        {"id": "api", "data": {"kind": "backend", "label": "API", "catalogId": "be-fastapi"}},
        {"id": "db", "data": {"kind": "database", "label": "DB", "catalogId": "db-postgres"}},
        {"id": "cache", "data": {"kind": "database", "label": "Cache", "catalogId": "db-redis"}},
    ]


def _create_graph(client: TestClient) -> str:
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Cost", "nodes": _chain_nodes(), "edges": []},
    ).json()
    return graph["id"]


# ---------------------------------------------------------------------------
# 2º usuário (não-dono) — padrão P1.2, mesmo shape de
# tests/test_resilience.py::_other_user_session (duplicado de propósito:
# importa entre suítes de teste, não reusa).
# ---------------------------------------------------------------------------

_OTHER_USER_PASSWORD = "SecurePass2"
_OTHER_USER_BIRTH = "1990-02-02"


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
                "phone": "+5511900002222",
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
# GET /graphs/{id}/cost-estimate — shape novo + 429
# ---------------------------------------------------------------------------


def test_cost_get_200_shape(client):
    gid = _create_graph(client)
    resp = client.get(f"/api/v1/graphs/{gid}/cost-estimate")
    assert resp.status_code == 200
    payload = resp.json()
    _assert_cost_shape(payload)
    assert payload["node_count"] == 3
    assert payload["priced_count"] == 3
    assert payload["total_usd_month"] == 25.0
    assert payload["summary"]


def test_cost_rate_limit_429_separate_bucket(client):
    """R5: limiter `cost` 60/60s — a 61ª chamada cai em 429 c/ Retry-After,
    sem tocar no bucket de resiliência (endpoint alheio segue 200)."""
    gid = _create_graph(client)
    url = f"/api/v1/graphs/{gid}/cost-estimate"
    for _ in range(60):
        assert client.get(url).status_code == 200
    denied = client.get(url)
    assert denied.status_code == 429
    assert denied.headers.get("retry-after") == "60"
    # Bucket `resilience:` é independente — custo exaurido não afeta ele.
    assert client.get(f"/api/v1/graphs/{gid}/circuit-breakers").status_code == 200


# ---------------------------------------------------------------------------
# POST /graphs/{id}/cost-estimate/live — canvas na mão (preview sem salvar)
# ---------------------------------------------------------------------------


def test_cost_post_live_200_shape(client):
    gid = _create_graph(client)
    saved = client.get(f"/api/v1/graphs/{gid}/cost-estimate").json()
    assert saved["total_usd_month"] == 25.0
    # Canvas diferente do salvo (só o Postgres + edges que são ignoradas —
    # contrato (a) é node-only) → total muda para 13.00.
    live = client.post(
        f"/api/v1/graphs/{gid}/cost-estimate/live",
        json={
            "nodes": [
                {"id": "db", "data": {"kind": "database", "label": "DB", "catalogId": "db-postgres"}},
            ],
            "edges": [{"id": "e1", "source": "api", "target": "db"}],
        },
    )
    assert live.status_code == 200
    payload = live.json()
    _assert_cost_shape(payload)
    assert payload["total_usd_month"] == 13.0
    assert payload["total_usd_month"] != saved["total_usd_month"]


def test_cost_post_live_422_invalid_body(client):
    gid = _create_graph(client)
    url = f"/api/v1/graphs/{gid}/cost-estimate/live"
    # `nodes` não é lista (Pydantic) → 422.
    assert client.post(url, json={"nodes": {"id": "x"}}).status_code == 422
    # `edges` não é lista (Pydantic) → 422.
    assert client.post(url, json={"nodes": [], "edges": "oops"}).status_code == 422
    # Item de `nodes` não é dict (validação do handler) → 422.
    assert client.post(url, json={"nodes": [1]}).status_code == 422
    assert client.post(url, json={"nodes": ["n1"]}).status_code == 422


# ---------------------------------------------------------------------------
# IDOR (item 1): grafo alheio → 404 nos dois endpoints, mesmo com body válido.
# ---------------------------------------------------------------------------


def test_cost_cross_user_404_idor(client):
    gid = _create_graph(client)
    with _other_user_session() as other:
        assert other.get(f"/api/v1/graphs/{gid}/cost-estimate").status_code == 404
        assert other.post(f"/api/v1/graphs/{gid}/cost-estimate/live", json={"nodes": []}).status_code == 404
    # O dono continua com acesso.
    assert client.get(f"/api/v1/graphs/{gid}/cost-estimate").status_code == 200


# ---------------------------------------------------------------------------
# 401 anônimo
# ---------------------------------------------------------------------------


def test_cost_anonymous_401(anonymous_client):
    gid = uuid.uuid4().hex[:36]
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/cost-estimate").status_code == 401
    assert anonymous_client.post(f"/api/v1/graphs/{gid}/cost-estimate/live", json={"nodes": []}).status_code == 401


# ---------------------------------------------------------------------------
# Tag OpenAPI: o path GET saiu do router "resilience" e vive em "cost" (R5).
# ---------------------------------------------------------------------------


def test_cost_openapi_tags():
    spec = app.openapi()
    get = spec["paths"]["/api/v1/graphs/{graph_id}/cost-estimate"]["get"]
    assert "cost" in get["tags"]
    assert "resilience" not in get["tags"]
    live = spec["paths"]["/api/v1/graphs/{graph_id}/cost-estimate/live"]["post"]
    assert "cost" in live["tags"]
    assert "resilience" not in live["tags"]
