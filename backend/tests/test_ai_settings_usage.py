"""Items 29/30/37/41 — settings por usuário, orçamento de IA durável, DLP e uso.

- Isolamento entre usuários (item 29)
- Orçamento persiste entre sessões/"restarts" + quotas manual/auto (item 30)
- Consentimento DLP: 403 p/ provedor externo, pass-through p/ local (item 37)
- Shape exato do GET /settings/ai/usage (item 41)
- Test de rascunho (draft) não persiste (item 9)
"""

import uuid

from fastapi import HTTPException
from fastapi.testclient import TestClient
import pytest

from app.database import SessionLocal
from app.main import app
from app.services.ai_usage import (
    ai_usage_summary,
    check_and_consume_analyze,
    record_llm_usage,
)

CONSENT_403_DETAIL = (
    "Ative o consentimento de envio de dados para IA externa em "
    "Configurações → Análise por IA antes de analisar"
)
MANUAL_BUDGET_429_DETAIL = "Orçamento diário de análises esgotado"
AUTO_BUDGET_429_DETAIL = "Orçamento diário de auto-análise esgotado"


def _minimal_payload() -> dict:
    return {
        "name": "usage-test",
        "nodes": [
            {"id": "n1", "type": "arch", "position": {"x": 0, "y": 0}, "data": {"kind": "backend", "label": "API"}},
        ],
        "edges": [],
    }


def _new_user_client() -> TestClient:
    """Segundo usuário autenticado no mesmo banco do fixture `client`."""
    username = f"usou{uuid.uuid4().hex[:8]}"
    c = TestClient(app)
    reg = c.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@usage.test",
            "password": "SecurePass1",
            "phone": "+5511900004444",
            "birth_date": "1990-01-01",
        },
    )
    assert reg.status_code in (200, 201), reg.text
    login = c.post("/api/v1/auth/login", json={"username": username, "password": "SecurePass1"})
    assert login.status_code == 200, login.text
    return c


# ---------------------------------------------------------------------------
# Item 29 — per-user isolation
# ---------------------------------------------------------------------------


def test_settings_isolation_between_users(client):
    put = client.put(
        "/api/v1/settings/ai",
        json={
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-isolate-alpha-111222",
            "model": "gpt-4o-mini",
            "enabled": True,
        },
    )
    assert put.status_code == 200

    b = _new_user_client()
    b_view = b.get("/api/v1/settings/ai").json()
    assert b_view["provider"] == "omniroute"  # A não vazou para B
    assert "alpha" not in b_view["api_key_masked"]
    assert "1122" not in b_view["api_key_masked"]

    # A continua com o próprio.
    assert client.get("/api/v1/settings/ai").json()["provider"] == "openai"


# ---------------------------------------------------------------------------
# Item 30 — durable daily budget
# ---------------------------------------------------------------------------


def test_budget_persists_across_sessions(client, monkeypatch):
    """Dois "restarts" (sessões separadas) veem o MESMO contador."""
    monkeypatch.setattr("app.rate_limit.LLM_DAILY_ANALYZE_BUDGET", 2)

    def _consume_once():
        db = SessionLocal()
        try:
            check_and_consume_analyze(db, 1234)
        finally:
            db.close()

    _consume_once()  # 1
    _consume_once()  # 2 — segundo "instância" ainda enxerga o contador
    with pytest.raises(HTTPException) as exc:
        _consume_once()  # 3 → estourou o teto de 2
    assert exc.value.status_code == 429
    assert exc.value.detail == MANUAL_BUDGET_429_DETAIL

    db = SessionLocal()
    try:
        assert ai_usage_summary(db, 1234)["analyze_used"] == 2
    finally:
        db.close()


def test_auto_and_manual_quotas_are_separate(client, monkeypatch):
    monkeypatch.setattr("app.rate_limit.LLM_DAILY_ANALYZE_BUDGET", 1)
    monkeypatch.setattr("app.rate_limit.AUTO_ANALYZE_DAILY_BUDGET", 1)

    db = SessionLocal()
    try:
        check_and_consume_analyze(db, 42, is_auto=False)
        check_and_consume_analyze(db, 42, is_auto=True)  # contadores independentes

        with pytest.raises(HTTPException) as manual_exc:
            check_and_consume_analyze(db, 42, is_auto=False)
        assert manual_exc.value.status_code == 429
        assert manual_exc.value.detail == MANUAL_BUDGET_429_DETAIL

        with pytest.raises(HTTPException) as auto_exc:
            check_and_consume_analyze(db, 42, is_auto=True)
        assert auto_exc.value.status_code == 429
        assert auto_exc.value.detail == AUTO_BUDGET_429_DETAIL

        summary = ai_usage_summary(db, 42)
        assert summary["analyze_used"] == 1
        assert summary["auto_used"] == 1
        assert summary["limit"] == 1
        assert summary["auto_limit"] == 1
    finally:
        db.close()


def test_record_llm_usage_accumulates(client):
    db = SessionLocal()
    try:
        record_llm_usage(db, 7, llm_calls=3, tokens_in=120, tokens_out=40)
        record_llm_usage(db, 7, llm_calls=1)  # tokens ausentes → 0
        summary = ai_usage_summary(db, 7)
        assert summary["llm_calls"] == 4
        assert summary["analyze_used"] == 0  # registro não consome quota
    finally:
        db.close()


def test_analyze_budget_429_via_api(client, no_omniroute, monkeypatch):
    monkeypatch.setattr("app.rate_limit.LLM_DAILY_ANALYZE_BUDGET", 1)
    payload = _minimal_payload()

    assert client.post("/api/v1/analyze", json=payload).status_code == 200
    second = client.post("/api/v1/analyze", json=payload)
    assert second.status_code == 429
    assert second.json()["detail"] == MANUAL_BUDGET_429_DETAIL

    usage = client.get("/api/v1/settings/ai/usage").json()
    assert usage["analyze_used"] == 1
    assert usage["limit"] == 1
    assert usage["auto_limit"] == 20


# ---------------------------------------------------------------------------
# Item 37 — DLP consent
# ---------------------------------------------------------------------------


def _external_settings(extra: dict | None = None) -> dict:
    base = {
        "provider": "openai",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-consent-test-123456",
        "model": "gpt-4o-mini",
        "enabled": True,
        "llm_data_consent": False,
    }
    return {**base, **(extra or {})}


def test_external_provider_without_consent_403(client, no_omniroute):
    put = client.put("/api/v1/settings/ai", json=_external_settings())
    assert put.status_code == 200
    assert put.json()["llm_data_consent"] is False

    live = client.post("/api/v1/analyze", json=_minimal_payload())
    assert live.status_code == 403
    assert live.json()["detail"] == CONSENT_403_DETAIL

    gid = client.post("/api/v1/graphs", json=_minimal_payload()).json()["id"]
    saved = client.post(f"/api/v1/graphs/{gid}/analyze")
    assert saved.status_code == 403
    assert saved.json()["detail"] == CONSENT_403_DETAIL

    # Consentindo desbloqueia os dois endpoints.
    ok = client.put("/api/v1/settings/ai", json=_external_settings({"llm_data_consent": True}))
    assert ok.status_code == 200
    assert ok.json()["llm_data_consent"] is True
    assert client.post("/api/v1/analyze", json=_minimal_payload()).status_code == 200
    assert client.post(f"/api/v1/graphs/{gid}/analyze").status_code == 200


def test_local_provider_passes_without_consent(client, no_omniroute):
    put = client.put(
        "/api/v1/settings/ai",
        json={
            "provider": "omniroute",
            "base_url": "http://localhost:20128/v1",
            "model": "auto/coding",
            "enabled": True,
            "llm_data_consent": False,
        },
    )
    assert put.status_code == 200
    assert client.post("/api/v1/analyze", json=_minimal_payload()).status_code == 200


# ---------------------------------------------------------------------------
# Item 41 — usage endpoint shape
# ---------------------------------------------------------------------------


def test_usage_endpoint_shape(client):
    body = client.get("/api/v1/settings/ai/usage").json()
    assert set(body) == {"day", "analyze_used", "auto_used", "llm_calls", "limit", "auto_limit"}
    assert body["limit"] == 50
    assert body["auto_limit"] == 20
    assert len(body["day"]) == 10
    assert body["analyze_used"] == 0
    assert body["auto_used"] == 0
    assert body["llm_calls"] == 0


# ---------------------------------------------------------------------------
# Item 9 — draft test (no persistence)
# ---------------------------------------------------------------------------


def test_draft_test_does_not_persist(client):
    base = client.get("/api/v1/settings/ai").json()
    assert base["provider"] == "omniroute"

    # Rascunho: provedor diferente + chave nova, em uma URL que não responde.
    draft = client.post(
        "/api/v1/settings/ai/test",
        json={
            "provider": "openai",
            "base_url": "http://127.0.0.1:1/v1",
            "model": "gpt-draft",
            "api_key": "sk-draft-not-saved",
        },
    )
    assert draft.status_code == 200
    assert draft.json()["ok"] is False  # rede inalcançável — a sonda rodou

    after = client.get("/api/v1/settings/ai").json()
    assert after["provider"] == "omniroute"  # nada foi salvo
    assert after["model"] == base["model"]
    assert "sk-draft" not in after["api_key_masked"]
    assert after["api_key_masked"] == base["api_key_masked"]  # chave salva intacta

    # Sem body: sonda as configurações salvas (comportamento original).
    stored = client.post("/api/v1/settings/ai/test")
    assert stored.status_code == 200
