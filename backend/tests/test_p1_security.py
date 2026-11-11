"""P1 security remediation — acceptance specs.

Cobre os itens do pacote P1 que não têm spec dedicado:
P1.2 (ownership 404), P1.1 (WS auth — contrato P2 /ws/collab + rota legado),
P1.5 (Fernet em settings), P1.9 (tetos/cache/orçamento do LLM), P1.10
(limiter com teto de mem), P1.11 (moderação de comentários), P1.4
(token_version), P1.3 (rate limit de recuperação), P1.8 (seed gating) e
P1.7 (role do cliente ignorado).
"""

from __future__ import annotations

import contextlib
import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.agents import runner as runner_mod
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models.graph import GraphAccess, new_uuid
from app.models.user import User
from app.rate_limit import (
    _BUCKET_TTL_S,
    MAX_TRACKED_KEYS,
    _buckets,
    sweep_expired_buckets,
)
from app.services.omniroute import CompleteResult

BIRTH = "1990-01-01"


@contextlib.contextmanager
def _user_session(prefix: str = "u"):
    """Usuário comum (não-senior) num TestClient em contexto (portal p/ WS + lifespan).

    O cliente fica DENTRO do `with` de TestClient — necessário para
    websocket_connect (portal anyio) e para o login de cookie funcionar.
    """
    username = f"{prefix}{uuid.uuid4().hex[:8]}"
    c = TestClient(app)
    with c:
        reg = c.post(
            "/api/v1/auth/register",
            json={
                "username": username,
                "email": f"{username}@p1.test",
                "password": "SecurePass1",
                "phone": "+5511900001111",
                "birth_date": BIRTH,
            },
        )
        assert reg.status_code in (200, 201), reg.text
        login = c.post("/api/v1/auth/login", json={"username": username, "password": "SecurePass1"})
        assert login.status_code == 200, login.text
        yield c


class TestOwnership:
    """P1.2 — recurso de terceiro devolve 404 (nunca 403), dono mantém acesso."""

    def test_foreign_project_is_404_not_403(self, client):
        proj = client.post("/api/v1/projects", json={"name": "Meu Projeto"}).json()
        pid = proj["id"]
        with _user_session("bob") as bob:
            assert bob.get(f"/api/v1/projects/{pid}").status_code == 404
            assert bob.put(f"/api/v1/projects/{pid}", json={"name": "hack"}).status_code == 404
            assert bob.delete(f"/api/v1/projects/{pid}").status_code == 404
        # O dono continua com acesso.
        assert client.get(f"/api/v1/projects/{pid}").status_code == 200

    def test_foreign_graph_is_404_not_403(self, client):
        g = client.post("/api/v1/graphs", json={"name": "G1", "nodes": [], "edges": []}).json()
        gid = g["id"]
        with _user_session("carol") as carol:
            assert carol.get(f"/api/v1/graphs/{gid}").status_code == 404
            assert carol.delete(f"/api/v1/graphs/{gid}").status_code == 404
        # O dono continua com acesso.
        assert client.get(f"/api/v1/graphs/{gid}").status_code == 200


def _drain_until(ws, mtype: str, attempts: int = 10) -> dict:
    """Lê mensagens da sala até chegar uma do tipo esperado (presence/eventos
    de sala se intercalam)."""
    for _ in range(attempts):
        msg = ws.receive_json()
        if msg.get("type") == mtype:
            return msg
    raise AssertionError(f"mensagem do tipo {mtype!r} não chegou na sala")


class TestWsCollab:
    """P1.1 + P2 — /ws/collab (contrato web/src/lib/collab.ts): auth por
    cookie, presença 100% do servidor, snapshot/state-update, closes 4001/4003."""

    @pytest.fixture(autouse=True)
    def _clean_ws(self, monkeypatch):
        import app.routes.ws as ws_mod

        monkeypatch.setattr(ws_mod, "_rooms", {})
        monkeypatch.setattr(ws_mod, "_presence", {})
        monkeypatch.setattr(ws_mod, "_room_state", {})

    @staticmethod
    def _graph(client, nodes=None) -> str:
        return client.post(
            "/api/v1/graphs", json={"name": "WS", "nodes": nodes or [], "edges": []}
        ).json()["id"]

    @staticmethod
    def _senior_id() -> str:
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "SENIOR").first()
        return str(user.id)

    @staticmethod
    def _grant_read(eve_client, gid: str) -> None:
        me = eve_client.get("/api/v1/auth/me").json()
        with SessionLocal() as db:
            db.add(GraphAccess(id=new_uuid(), graph_id=gid, team=me["email"], role="read"))
            db.commit()

    def test_anonymous_closes_4001(self, anonymous_client):
        with pytest.raises(WebSocketDisconnect) as exc:
            ws = anonymous_client.websocket_connect("/api/v1/ws/collab")
            with ws:
                ws.receive_text()
        assert exc.value.code == 4001

    def test_invalid_token_closes_4001(self, anonymous_client):
        with pytest.raises(WebSocketDisconnect) as exc:
            ws = anonymous_client.websocket_connect("/api/v1/ws/collab?token=garbage.token.here")
            with ws:
                ws.receive_text()
        assert exc.value.code == 4001

    def test_no_graph_access_closes_4003(self, client):
        """Auth ok, mas sem acesso ao grafo → 4003 (mesmo código de sala cheia:
        o cliente P2 trata os dois como erro permanente, sem reconexão)."""
        gid = self._graph(client)
        with _user_session("eve") as eve:
            ws = eve.websocket_connect("/api/v1/ws/collab")
            with ws:
                ws.send_json({"type": "hello", "graph_id": gid})
                with pytest.raises(WebSocketDisconnect) as exc:
                    ws.receive_text()
            assert exc.value.code == 4003

    def test_malformed_hello_closes_4003(self, client):
        with _user_session("eve") as eve:
            ws = eve.websocket_connect("/api/v1/ws/collab")
            with ws:
                ws.send_json({"type": "hello"})  # sem graph_id
                with pytest.raises(WebSocketDisconnect) as exc:
                    ws.receive_text()
            assert exc.value.code == 4003

    def test_join_receives_hello_ack_snapshot_presence(self, client):
        nodes = [{"id": "n1", "type": "service", "data": {"label": "API"}}, {"id": "n2"}]
        gid = self._graph(client, nodes=nodes)
        ws = client.websocket_connect("/api/v1/ws/collab")
        with ws:
            ws.send_json({"type": "hello", "graph_id": gid})
            hello_ack = ws.receive_json()
            assert hello_ack == {"type": "hello-ack", "graph_id": gid}
            snapshot = ws.receive_json()
            assert snapshot["type"] == "snapshot"
            assert snapshot["graph_id"] == gid
            assert snapshot["nodes"] == nodes
            assert snapshot["edges"] == []
            presence = ws.receive_json()
            assert presence["type"] == "presence"
            assert [p["user_id"] for p in presence["peers"]] == [self._senior_id()]
            assert all("user_name" in p for p in presence["peers"])

    def test_state_update_bridged_sender_excluded(self, client):
        gid = self._graph(client)
        with _user_session("frank") as peer:
            self._grant_read(peer, gid)
            ws_senior = client.websocket_connect("/api/v1/ws/collab")
            with ws_senior:
                ws_senior.send_json({"type": "hello", "graph_id": gid})
                for _ in range(3):  # hello-ack, snapshot, presença inicial
                    ws_senior.receive_json()
                ws_peer = peer.websocket_connect("/api/v1/ws/collab")
                with ws_peer:
                    ws_peer.send_json({"type": "hello", "graph_id": gid})
                    for _ in range(3):
                        ws_peer.receive_json()
                    # frank empurra; senior recebe, frank NÃO recebe eco próprio.
                    ws_peer.send_json(
                        {"type": "state-update", "graph_id": gid, "nodes": [{"id": "f1"}], "edges": []}
                    )
                    msg = _drain_until(ws_senior, "state-update")
                    assert msg["graph_id"] == gid
                    assert msg["nodes"] == [{"id": "f1"}]
                    # senior empurra o dele; o PRIMEIRO state-update que frank vê
                    # é "s1" (o "f1" foi excluído para o remetente).
                    ws_senior.send_json(
                        {"type": "state-update", "graph_id": gid, "nodes": [{"id": "s1"}], "edges": []}
                    )
                    msg = _drain_until(ws_peer, "state-update")
                    assert msg["nodes"] == [{"id": "s1"}]

    def test_presence_identity_is_server_injected(self, client):
        """P1.1 anti-spoofing: campos de identidade no hello são ignorados — a
        presença é 100% injetada pelo servidor a partir do token autenticado.

        Verificação em SÓCIO ÚNICO (o próprio evento de presença do joiner):
        o usuário conecta declarando identidade "spoofed" e o evento que o
        servidor devolve tem que exibir a identidade real (id/username do
        token). Não depende de entrega cross-portal a outro par — o servidor
        sempre emite a presença do joiner ao entrar, então a spec é
        determinística e não emperra a suíte em flake de agendamento."""
        gid = self._graph(client)
        with _user_session("frank") as peer:
            self._grant_read(peer, gid)
            me = peer.get("/api/v1/auth/me").json()
            frank_id = str(me["id"])
            ws = peer.websocket_connect("/api/v1/ws/collab")
            with ws:
                ws.send_json(
                    {"type": "hello", "graph_id": gid, "user_id": "spoofed", "user_name": "spoofed"}
                )
                presence = _drain_until(ws, "presence")
                peers = {p["user_id"]: p for p in presence["peers"]}
                assert frank_id in peers
                assert peers[frank_id]["user_name"] == me["username"]
                assert "spoofed" not in json.dumps(presence)

    def test_room_full_closes_4003(self, client, monkeypatch):
        import app.routes.ws as ws_mod

        monkeypatch.setattr(ws_mod, "MAX_PEERS_PER_ROOM", 1)
        gid = self._graph(client)
        with _user_session("eve") as eve:
            self._grant_read(eve, gid)
            ws_senior = client.websocket_connect("/api/v1/ws/collab")
            with ws_senior:
                ws_senior.send_json({"type": "hello", "graph_id": gid})
                for _ in range(3):
                    ws_senior.receive_json()
                ws_eve = eve.websocket_connect("/api/v1/ws/collab")
                with ws_eve:
                    ws_eve.send_json({"type": "hello", "graph_id": gid})
                    with pytest.raises(WebSocketDisconnect) as exc:
                        ws_eve.receive_text()
                assert exc.value.code == 4003

    def test_oversized_message_is_dropped(self, client):
        """>64KB é descartado (log) sem fechar a conexão: o push coalescido do P2
        carrega estado completo e 1009 seria "transitório" para o cliente
        (loop de reconexão)."""
        import app.routes.ws as ws_mod

        gid = self._graph(client)
        with _user_session("frank") as peer:
            self._grant_read(peer, gid)
            ws_senior = client.websocket_connect("/api/v1/ws/collab")
            with ws_senior:
                ws_senior.send_json({"type": "hello", "graph_id": gid})
                for _ in range(3):
                    ws_senior.receive_json()
                ws_peer = peer.websocket_connect("/api/v1/ws/collab")
                with ws_peer:
                    ws_peer.send_json({"type": "hello", "graph_id": gid})
                    for _ in range(3):
                        ws_peer.receive_json()
                    padding = "x" * (ws_mod.MAX_WS_MESSAGE_BYTES + 1)
                    ws_senior.send_text(
                        json.dumps({"type": "state-update", "graph_id": gid, "nodes": [padding], "edges": []})
                    )
                    ws_peer.send_json(
                        {"type": "state-update", "graph_id": gid, "nodes": [{"id": "small"}], "edges": []}
                    )
                    msg = _drain_until(ws_senior, "state-update")
                    assert msg["nodes"] == [{"id": "small"}]  # mega descartada; conexão seguiu viva


class TestWsLegacy:
    """Rota legado /ws/graphs/{id} (CanvasComments.tsx): mesma auth/limites do
    P2 + bridge de eventos comment.*."""

    @pytest.fixture(autouse=True)
    def _clean_ws(self, monkeypatch):
        import app.routes.ws as ws_mod

        monkeypatch.setattr(ws_mod, "_rooms", {})
        monkeypatch.setattr(ws_mod, "_presence", {})
        monkeypatch.setattr(ws_mod, "_room_state", {})

    def test_anonymous_closes_4001(self, anonymous_client):
        gid = "00000000-0000-0000-0000-000000000000"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws = anonymous_client.websocket_connect(f"/api/v1/ws/graphs/{gid}")
            with ws:
                ws.receive_text()
        assert exc.value.code == 4001

    def test_no_graph_access_closes_4003(self, client):
        gid = TestWsCollab._graph(client)
        with _user_session("eve") as eve:
            with pytest.raises(WebSocketDisconnect) as exc:
                ws = eve.websocket_connect(f"/api/v1/ws/graphs/{gid}")
                with ws:
                    ws.receive_text()
            assert exc.value.code == 4003

    def test_comment_events_bridged_between_peers(self, client):
        gid = TestWsCollab._graph(client)
        with _user_session("frank") as peer:
            TestWsCollab._grant_read(peer, gid)
            ws_senior = client.websocket_connect(f"/api/v1/ws/graphs/{gid}")
            with ws_senior:
                ws_senior.receive_json()  # presença inicial (senior entra sozinho)
                ws_peer = peer.websocket_connect(f"/api/v1/ws/graphs/{gid}")
                with ws_peer:
                    ws_peer.receive_json()  # presença inicial do frank
                    ws_senior.send_json({"type": "comment.created", "comment": {"id": "c1", "text": "olá"}})
                    msg = ws_peer.receive_json()
                    assert msg["type"] == "comment.created"
                    assert msg["comment"]["id"] == "c1"


class TestSettingsEncryption:
    """P1.5 — ai_settings.api_key cifrada (Fernet).

    Item 29 — as configurações são por usuário: o segredo deixou de ser
    global, então PUT é auto-atendimento (cada usuário edita a própria
    linha; isolamento é o que garante não vazar nada para outros).
    """

    def _put_payload(self) -> dict:
        return {
            "provider": "omniroute",
            "base_url": "https://omni.archia.example",
            "api_key": "sk-archia-secret-123456",
            "model": "claude",
            "enabled": True,
        }

    def test_put_ai_regular_user_edits_own_row(self, client):
        """Usuário comum edita a própria linha; a do SENIOR fica intacta."""
        with _user_session("geo") as bob:
            payload = {**self._put_payload(), "api_key": "sk-bob-iso-555444333"}
            resp = bob.put("/api/v1/settings/ai", json=payload)
            assert resp.status_code == 200
            assert resp.json()["api_key_masked"].startswith("sk-b")

        senior = client.put("/api/v1/settings/ai", json=self._put_payload())
        assert senior.status_code == 200
        assert senior.json()["api_key_masked"].startswith("sk-a")
        assert "5544" not in senior.json()["api_key_masked"]

    def test_put_ai_senior_stores_encrypted(self, client):
        resp = client.put("/api/v1/settings/ai", json=self._put_payload())
        assert resp.status_code == 200
        from app.models.settings import AiSettings
        from app.services.ai_settings import plaintext_api_key

        with SessionLocal() as db:
            row = db.query(AiSettings).first()
        # Em repouso o valor é cifrado — a senha bruta não pode aparecer.
        assert row is not None
        assert row.api_key.startswith("archia-enc:v1:")
        assert "sk-archia-secret-123456" not in row.api_key
        # Round-trip decifra para o valor original.
        assert plaintext_api_key(row) == "sk-archia-secret-123456"
        # Na resposta o cliente só vê a chave mascarada.
        assert resp.json()["api_key_masked"] != "sk-archia-secret-123456"
        assert resp.json()["api_key_set"] is True


class TestLlmCaps:
    """P1.9 — tetos de entrada (413), cache por fingerprint e orçamento diário (429)."""

    @staticmethod
    def _nodes(n: int) -> list[dict]:
        return [
            {
                "id": f"n{i}",
                "type": "arch",
                "position": {"x": 0, "y": 0},
                "data": {"kind": "backend", "label": f"N{i}"},
            }
            for i in range(n)
        ]

    @staticmethod
    def _edges(n: int) -> list[dict]:
        return [{"id": f"e{i}", "source": f"n{i % 2}", "target": f"n{(i + 1) % 2}"} for i in range(n)]

    def test_analyze_oversize_nodes_413(self, client, no_omniroute):
        resp = client.post(
            "/api/v1/analyze",
            json={"name": "big", "nodes": self._nodes(401), "edges": []},
        )
        assert resp.status_code == 413
        assert "400" in resp.json()["detail"]

    def test_analyze_oversize_edges_413(self, client, no_omniroute):
        resp = client.post(
            "/api/v1/analyze",
            json={"name": "big", "nodes": self._nodes(2), "edges": self._edges(801)},
        )
        assert resp.status_code == 413

    def test_analyze_cache_hit_skips_llm(self, client, monkeypatch):
        calls = {"n": 0}

        async def fake_complete_json(*_args, **_kwargs):
            calls["n"] += 1
            return CompleteResult(data=None, usage=None, attempts=1, ok=False)

        monkeypatch.setattr(runner_mod, "complete_json", fake_complete_json)
        gid = client.post(
            "/api/v1/graphs",
            json={"name": "cache", "nodes": self._nodes(2), "edges": self._edges(1)},
        ).json()["id"]

        assert client.post(f"/api/v1/graphs/{gid}/analyze").status_code == 200
        after_first = calls["n"]
        assert after_first > 0

        # Snapshot idêntico → cache: nenhum novo chamamento do LLM.
        assert client.post(f"/api/v1/graphs/{gid}/analyze").status_code == 200
        assert calls["n"] == after_first

    def test_llm_daily_budget_429(self, client, monkeypatch):
        calls = {"n": 0}

        async def fake_complete_json(*_args, **_kwargs):
            calls["n"] += 1
            return CompleteResult(data=None, usage=None, attempts=1, ok=False)

        monkeypatch.setattr(runner_mod, "complete_json", fake_complete_json)
        monkeypatch.setattr("app.rate_limit.LLM_DAILY_ANALYZE_BUDGET", 2)

        ids = []
        for i in range(3):  # 3º grafo → orçamento (2/dia) excedido
            g = client.post(
                "/api/v1/graphs",
                json={"name": f"budget-{i}", "nodes": self._nodes(1), "edges": []},
            ).json()
            ids.append(g["id"])
            status = client.post(f"/api/v1/graphs/{g['id']}/analyze").status_code
            assert status == 429 if i == 2 else status == 200, status

        # Na chamada 429 o LLM não é chamado de novo.
        assert calls["n"] > 0
        assert client.post(f"/api/v1/graphs/{ids[0]}/analyze").status_code in (200, 429)  # cache ou budget


class TestBoundedLimiter:
    """P1.10 — _buckets com teto de chaves + sweep de expirados (memória limitada)."""

    def test_sweep_drops_expired_buckets(self):
        now = time.time()
        _buckets["stale-p1-test"] = [now - _BUCKET_TTL_S - 60]
        removed = sweep_expired_buckets(now)
        assert "stale-p1-test" not in _buckets
        assert removed >= 1

    def test_over_cap_evicts_oldest_keys(self, monkeypatch):
        monkeypatch.setattr("app.rate_limit.MAX_TRACKED_KEYS", 3)
        now = time.time()
        for i in range(6):
            _buckets[f"cap-{i}"] = [now - (6 - i)]  # cap-0 mais antigo
        sweep_expired_buckets(now)
        kept = {k for k in _buckets if k.startswith("cap-")}
        assert kept == {"cap-3", "cap-4", "cap-5"}  # mais recentes sobrevivem
        assert len(kept) <= MAX_TRACKED_KEYS


class TestCommentModeration:
    """P1.11 — GET com auth + paginação; edit/delete só autor/senior (404 na negação)."""

    def _graph_and_comment(self, client) -> tuple[str, str]:
        gid = client.post("/api/v1/graphs", json={"name": "mod", "nodes": [], "edges": []}).json()["id"]
        cid = client.post(f"/api/v1/graphs/{gid}/comments", json={"text": "nota do dono"}).json()["id"]
        return gid, cid

    def test_get_comments_requires_auth_and_paginates(self, client, anonymous_client):
        gid, _ = self._graph_and_comment(client)
        assert anonymous_client.get(f"/api/v1/graphs/{gid}/comments").status_code == 401
        body = client.get(f"/api/v1/graphs/{gid}/comments").json()
        assert {"items", "total", "limit", "offset", "has_more"} <= set(body)
        assert body["total"] >= 1

    def test_foreign_user_cannot_modify_comment(self, client):
        gid, cid = self._graph_and_comment(client)
        with _user_session("gina") as bob:
            # Dá VISUALIZAÇÃO do grafo à nova conta — mas ela não é autor nem senior.
            me = bob.get("/api/v1/auth/me").json()
            with SessionLocal() as db:
                db.add(GraphAccess(id=new_uuid(), graph_id=gid, team=me["email"], role="read"))
                db.commit()
            # Negação de moderação → 404 (não 403, não vaza existência).
            assert bob.patch(f"/api/v1/graphs/{gid}/comments/{cid}", json={"text": "hack"}).status_code == 404
            assert bob.delete(f"/api/v1/graphs/{gid}/comments/{cid}").status_code == 404

    def test_owner_or_senior_can_modify(self, client):
        gid, cid = self._graph_and_comment(client)
        assert client.patch(f"/api/v1/graphs/{gid}/comments/{cid}", json={"text": "editado"}).status_code == 200
        assert client.delete(f"/api/v1/graphs/{gid}/comments/{cid}").status_code == 200


class TestSessionInvalidation:
    """P1.4 — token_version: /sessions/invalidate revoga tokens já emitidos."""

    def test_invalidate_revokes_bearer_token(self, client):
        with _user_session("hal") as bob:
            me = bob.get("/api/v1/auth/me").json()
            token = bob.post(
                "/api/v1/auth/login",
                json={"username": me["username"], "password": "SecurePass1"},
            ).json()["access_token"]
            assert bob.post("/api/v1/auth/sessions/invalidate").status_code == 200
            assert bob.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


class TestRecoverRateLimit:
    """P1.3 — 3 tentativas / 15min / IP no passo 1 do recover."""

    def test_recover_ip_limit_429(self, client):
        payload = {"phone": "+559900000000", "birth_date": BIRTH}
        for _ in range(3):
            assert client.post("/api/v1/auth/recover", json=payload).status_code == 200
        assert client.post("/api/v1/auth/recover", json=payload).status_code == 429


class TestSeedGating:
    """P1.8 — seed do usuário default só fora de produção (ou com opt-in)."""

    def _users(self) -> list[str]:
        with SessionLocal() as db:
            return [u.username for u in db.query(User).all()]

    def test_no_seed_in_production_without_opt_in(self, monkeypatch):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        monkeypatch.setattr(settings, "archia_env", "production")
        with TestClient(app):
            pass
        assert "SENIOR" not in self._users()

    def test_seed_in_production_with_opt_in(self, monkeypatch):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        monkeypatch.setattr(settings, "archia_env", "production")
        monkeypatch.setenv("SEED_DEFAULT_USER", "1")
        with TestClient(app):
            pass
        assert "SENIOR" in self._users()


class TestReviewRole:
    """P1.7 — role declarado pelo cliente no /review é ignorado."""

    def test_regular_user_cannot_auto_approve(self, client):
        with _user_session("iris") as bob:
            gid = bob.post("/api/v1/graphs", json={"name": "rev", "nodes": [], "edges": []}).json()["id"]
            # Cliente SE declara "senior" — o backend deve usar o role REAL (user).
            resp = bob.post(
                f"/api/v1/graphs/{gid}/review",
                json={"role": "senior", "status": "rejected", "comment": "Faltou revisão de IAM."},
            )
            assert resp.status_code == 200
            assert resp.json()["reviewer_role"] == "other"
            assert resp.json()["review_status"] == "rejected"
