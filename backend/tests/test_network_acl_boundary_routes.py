"""R1 — IDOR + role checks em network/acl/boundary (mesma classe de bug).

Cobre a semântica nova travada por teste:
- network: GET (view) IDOR-safe + `rate_limit_network` 30/60s (R3);
- acl: GET (view) com tolerância em leitura legada; POST/DELETE exigem
  write — terceiro 404, grant só-leitura bloqueia escrita, grant write libera;
- boundary: GET (view); POST/DELETE exigem write.
"""

import contextlib
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.graph import GraphAccess, new_uuid

# ---------------------------------------------------------------------------
# Canvas de rede — 1 finding warning (SG sem regras) + 1 critical
# (NACL sem deny) → score 80 determinístico.
# ---------------------------------------------------------------------------

NETWORK_NODES = [
    {"id": "sg1", "data": {"kind": "service", "label": "SG Ingresso", "catalogId": "sec-sg", "securityGroupRules": []}},
    {"id": "nacl1", "data": {"kind": "service", "label": "NACL Perímetro", "catalogId": "net-nacl"}},
]
NETWORK_EDGES: list[dict] = []

NETWORK_POLICY_KEYS = {"ok", "score", "summary", "findings"}
DEPLOYMENT_FLOW_KEYS = {"ok", "dev_flow", "user_flow", "cross_flow", "gaps"}
FLOW_SUBKEYS = {"node_count", "edge_count", "edges"}

OTHER_USER_PASSWORD = "SecurePass9"
OTHER_USER_BIRTH = "1990-04-04"


@contextlib.contextmanager
def _user_session():
    """Usuário comum registrado + logado num TestClient próprio.

    Yields (client, username) — o `username` é o token de grant nas ACLs
    de squad (``_grantee_tokens`` casa por username/e-mail).
    """
    username = f"u{uuid.uuid4().hex[:8]}"
    client = TestClient(app)
    with client:
        reg = client.post(
            "/api/v1/auth/register",
            json={
                "username": username,
                "email": f"{username}@archia.test",
                "password": OTHER_USER_PASSWORD,
                "phone": "+5511900005555",
                "birth_date": OTHER_USER_BIRTH,
            },
        )
        assert reg.status_code in (200, 201), reg.text
        login = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": OTHER_USER_PASSWORD},
        )
        assert login.status_code == 200, login.text
        yield client, username


def _create_graph(client: TestClient, nodes: list[dict] | None = None, edges: list[dict] | None = None) -> str:
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Net/Acl/Boundary", "nodes": nodes or [], "edges": edges or []},
    ).json()
    return graph["id"]


# ---------------------------------------------------------------------------
# network — shape atual preservado (R3: só ownership + limiter)
# ---------------------------------------------------------------------------


def test_network_get_owner_ok(client):
    gid = _create_graph(client, NETWORK_NODES, NETWORK_EDGES)
    policy = client.get(f"/api/v1/graphs/{gid}/network-policy")
    assert policy.status_code == 200
    body = policy.json()
    assert set(body.keys()) == NETWORK_POLICY_KEYS
    assert body["score"] == 80
    assert len(body["findings"]) == 2

    flows = client.get(f"/api/v1/graphs/{gid}/deployment-flows")
    assert flows.status_code == 200
    body = flows.json()
    assert set(body.keys()) == DEPLOYMENT_FLOW_KEYS
    assert set(body["dev_flow"].keys()) == FLOW_SUBKEYS
    assert set(body["user_flow"].keys()) == FLOW_SUBKEYS
    # cross_flow é classificado por aresta — sem node_count (shape do service).
    assert set(body["cross_flow"].keys()) == {"edge_count", "edges"}


def test_network_get_idor_404(client):
    gid = _create_graph(client, NETWORK_NODES)
    with _user_session() as (other, _):
        assert other.get(f"/api/v1/graphs/{gid}/network-policy").status_code == 404
        assert other.get(f"/api/v1/graphs/{gid}/deployment-flows").status_code == 404
    # O dono continua com acesso.
    assert client.get(f"/api/v1/graphs/{gid}/network-policy").status_code == 200


def test_network_rate_limit_429_shared_bucket(client):
    """R3: `rate_limit_network` 30/60s — a 31ª chamada cai em 429 c/
    Retry-After; o bucket é compartilhado pelos dois endpoints de rede."""
    gid = _create_graph(client, NETWORK_NODES)
    url = f"/api/v1/graphs/{gid}/network-policy"
    for _ in range(30):
        assert client.get(url).status_code == 200
    denied = client.get(url)
    assert denied.status_code == 429
    assert denied.headers.get("retry-after") == "60"
    assert client.get(f"/api/v1/graphs/{gid}/deployment-flows").status_code == 429


def test_network_anonymous_401(anonymous_client):
    gid = uuid.uuid4().hex[:36]
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/network-policy").status_code == 401
    assert anonymous_client.get(f"/api/v1/graphs/{gid}/deployment-flows").status_code == 401


# ---------------------------------------------------------------------------
# acl — dono ok; terceiro 404; read bloqueia escrita; write libera;
# leitura tolera linhas legadas (valores que violam a validação de escrita).
# ---------------------------------------------------------------------------


def test_acl_owner_crud(client):
    gid = _create_graph(client)
    assert client.get(f"/api/v1/graphs/{gid}/access").json() == []
    created = client.post(f"/api/v1/graphs/{gid}/access", json={"team": "ads-team", "role": "write"})
    assert created.status_code == 200
    assert created.json() == {"team": "ads-team", "role": "write"}
    assert client.get(f"/api/v1/graphs/{gid}/access").json() == [{"team": "ads-team", "role": "write"}]
    updated = client.post(f"/api/v1/graphs/{gid}/access", json={"team": "ads-team", "role": "admin"})
    assert updated.json() == {"team": "ads-team", "role": "admin"}
    deleted = client.delete(f"/api/v1/graphs/{gid}/access/ads-team")
    assert deleted.status_code == 200
    assert deleted.json() == {"ok": True}
    assert client.get(f"/api/v1/graphs/{gid}/access").json() == []


def test_acl_third_party_all_404(client):
    gid = _create_graph(client)
    with _user_session() as (other, uname):
        assert other.get(f"/api/v1/graphs/{gid}/access").status_code == 404
        assert other.post(f"/api/v1/graphs/{gid}/access", json={"team": "x-team", "role": "read"}).status_code == 404
        assert other.delete(f"/api/v1/graphs/{gid}/access/{uname}").status_code == 404


def test_acl_read_role_cannot_write_write_role_ok(client):
    gid = _create_graph(client)
    with _user_session() as (other, uname):
        assert client.post(f"/api/v1/graphs/{gid}/access", json={"team": uname, "role": "read"}).status_code == 200
        listed = other.get(f"/api/v1/graphs/{gid}/access").json()
        assert {"team": uname, "role": "read"} in listed
        # ACL só de leitura: GET 200, POST/DELETE 404.
        assert other.post(f"/api/v1/graphs/{gid}/access", json={"team": "x-team", "role": "read"}).status_code == 404
        assert other.delete(f"/api/v1/graphs/{gid}/access/{uname}").status_code == 404
        # Upgrade para write: POST/DELETE passam a 200.
        assert client.post(f"/api/v1/graphs/{gid}/access", json={"team": uname, "role": "write"}).status_code == 200
        assert other.post(f"/api/v1/graphs/{gid}/access", json={"team": "x-team", "role": "read"}).status_code == 200
        deleted = other.delete(f"/api/v1/graphs/{gid}/access/{uname}")
        assert deleted.status_code == 200 and deleted.json() == {"ok": True}
        # Grant do próprio usuário foi removido → acesso some (404).
        assert other.get(f"/api/v1/graphs/{gid}/access").status_code == 404
        # O grant de x-team (criado por ele com write) continua no grafo.
        assert {"team": "x-team", "role": "read"} in client.get(f"/api/v1/graphs/{gid}/access").json()


def test_acl_legacy_read_tolerated(client):
    """Leitura NÃO revalida o passado: `team` com `@` ou espaço viola a
    validação atual de `TeamAccess` (R9) mas continua listável sem 500/422."""
    gid = _create_graph(client)
    with SessionLocal() as db:
        db.add(GraphAccess(id=new_uuid(), graph_id=gid, team="legacy-user@archia.test", role="read"))
        db.add(GraphAccess(id=new_uuid(), graph_id=gid, team="Back Office", role="write"))
        db.commit()
    listed = client.get(f"/api/v1/graphs/{gid}/access")
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 2
    assert {row["team"] for row in rows} == {"legacy-user@archia.test", "Back Office"}
    # Escrita continua estrita: o mesmo valor legado é 422 no POST.
    assert client.post(f"/api/v1/graphs/{gid}/access", json={"team": "legacy-user@archia.test", "role": "read"}).status_code == 422


# ---------------------------------------------------------------------------
# boundary — dono ok; terceiro 404; read bloqueia escrita; write libera.
# ---------------------------------------------------------------------------


def _create_boundary_contract(client: TestClient, gid: str) -> str:
    created = client.post(
        f"/api/v1/graphs/{gid}/boundary-contracts",
        json={"source_zone": "ingest", "target_zone": "encoding", "protocol": "async", "sla_ms": 500},
    )
    assert created.status_code == 200 and created.json() == {"ok": True}
    return client.get(f"/api/v1/graphs/{gid}/boundary-contracts").json()[0]["id"]


def test_boundary_owner_crud(client):
    gid = _create_graph(client)
    contract_id = _create_boundary_contract(client, gid)
    listed = client.get(f"/api/v1/graphs/{gid}/boundary-contracts").json()
    assert len(listed) == 1
    assert listed[0]["source_zone"] == "ingest"
    assert listed[0]["target_zone"] == "encoding"
    assert listed[0]["sla_ms"] == 500
    deleted = client.delete(f"/api/v1/graphs/{gid}/boundary-contracts/{contract_id}")
    assert deleted.status_code == 200 and deleted.json() == {"ok": True}
    assert client.get(f"/api/v1/graphs/{gid}/boundary-contracts").json() == []


def test_boundary_third_party_all_404(client):
    gid = _create_graph(client)
    contract_id = _create_boundary_contract(client, gid)
    with _user_session() as (other, _):
        assert other.get(f"/api/v1/graphs/{gid}/boundary-contracts").status_code == 404
        assert other.post(f"/api/v1/graphs/{gid}/boundary-contracts", json={"source_zone": "a", "target_zone": "b"}).status_code == 404
        # Contrato REAL do dono: o 404 é de ownership, não de "inexistente".
        assert other.delete(f"/api/v1/graphs/{gid}/boundary-contracts/{contract_id}").status_code == 404


def test_boundary_read_role_cannot_write_write_role_ok(client):
    gid = _create_graph(client)
    contract_id = _create_boundary_contract(client, gid)
    with _user_session() as (other, uname):
        assert client.post(f"/api/v1/graphs/{gid}/access", json={"team": uname, "role": "read"}).status_code == 200
        listed = other.get(f"/api/v1/graphs/{gid}/boundary-contracts").json()
        assert len(listed) == 1
        # ACL só de leitura: GET 200, POST/DELETE 404.
        assert other.post(f"/api/v1/graphs/{gid}/boundary-contracts", json={"source_zone": "x", "target_zone": "y"}).status_code == 404
        assert other.delete(f"/api/v1/graphs/{gid}/boundary-contracts/{contract_id}").status_code == 404
        # Upgrade para write: POST/DELETE passam a 200.
        assert client.post(f"/api/v1/graphs/{gid}/access", json={"team": uname, "role": "write"}).status_code == 200
        assert other.post(f"/api/v1/graphs/{gid}/boundary-contracts", json={"source_zone": "x", "target_zone": "y"}).status_code == 200
        deleted = other.delete(f"/api/v1/graphs/{gid}/boundary-contracts/{contract_id}")
        assert deleted.status_code == 200 and deleted.json() == {"ok": True}
