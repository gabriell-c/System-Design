def test_ai_settings_get_default(client):
    response = client.get("/api/v1/settings/ai")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] in {"omniroute", "openai", "anthropic", "custom"}
    assert "base_url" in body
    assert "model" in body
    assert "api_key_set" in body
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
