import uuid

from fastapi.testclient import TestClient

from app.main import app


def _new_user_client(username: str | None = None) -> TestClient:
    """Cliente autenticado de um usuário NOVO (mesmo engine/DB do fixture client)."""
    username = username or f"isou{uuid.uuid4().hex[:8]}"
    c = TestClient(app)
    reg = c.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@iso.test",
            "password": "SecurePass1",
            "phone": "+5511900003333",
            "birth_date": "1990-01-01",
        },
    )
    assert reg.status_code in (200, 201), reg.text
    login = c.post("/api/v1/auth/login", json={"username": username, "password": "SecurePass1"})
    assert login.status_code == 200, login.text
    return c


def test_ai_settings_get_default(client):
    response = client.get("/api/v1/settings/ai")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] in {"omniroute", "openai", "anthropic", "custom"}
    assert "base_url" in body
    assert "model" in body
    assert "api_key_set" in body
    assert "llm_data_consent" in body
    assert "api_key" not in body


def test_ai_settings_update_and_mask(client):
    response = client.put(
        "/api/v1/settings/ai",
        json={
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-test-secret-key-123456",
            "model": "gpt-4o-mini",
            "enabled": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openai"
    assert body["api_key_set"] is True
    assert body["api_key_masked"].startswith("sk-t")
    assert "secret" not in body["api_key_masked"]
    assert body["llm_data_consent"] is False

    again = client.put(
        "/api/v1/settings/ai",
        json={
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "enabled": True,
        },
    )
    assert again.status_code == 200
    assert again.json()["api_key_set"] is True


def test_ai_settings_user_isolation(client):
    """Item 29 — usuário B não vê (nem afeta) as configurações do usuário A."""
    a = client.put(
        "/api/v1/settings/ai",
        json={
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-userA-000111222333",
            "model": "gpt-4o-mini",
            "enabled": True,
        },
    )
    assert a.status_code == 200
    assert a.json()["api_key_masked"].startswith("sk-u")

    # Usuário B no mesmo banco: linha própria, criada na primeira leitura.
    b_client = _new_user_client()
    b_view = b_client.get("/api/v1/settings/ai")
    assert b_view.status_code == 200
    b_body = b_view.json()
    assert b_body["provider"] == "omniroute"  # padrão local, não o openai do A
    assert "userA" not in b_body["api_key_masked"]
    assert "1122" not in b_body["api_key_masked"]  # sufixo da chave de A

    # B grava a própria chave → A continua isolado.
    b_put = b_client.put(
        "/api/v1/settings/ai",
        json={
            "provider": "anthropic",
            "base_url": "https://api.anthropic.com/v1",
            "api_key": "sk-userB-999888777666",
            "model": "claude-x",
            "enabled": True,
        },
    )
    assert b_put.status_code == 200
    assert b_put.json()["api_key_masked"].startswith("sk-u")
    assert "7666" in b_put.json()["api_key_masked"]

    a_again = client.get("/api/v1/settings/ai").json()
    assert a_again["provider"] == "openai"
    assert "2333" in a_again["api_key_masked"]
    assert "7666" not in a_again["api_key_masked"]
    b_again = b_client.get("/api/v1/settings/ai").json()
    assert b_again["provider"] == "anthropic"
