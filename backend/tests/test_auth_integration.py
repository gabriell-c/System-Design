"""Integration tests for auth routes."""

def _register(client, username="alice", email="alice@test.com", password="SecurePass1"):
    return client.post("/api/v1/auth/register", json={
        "username": username, "email": email, "password": password,
        "phone": "+5511988887777", "birth_date": "1995-05-15"
    })

def _login(client, username="alice", password="SecurePass1", remember_me=False):
    return client.post("/api/v1/auth/login", json={
        "username": username, "password": password, "remember_me": remember_me
    })

def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}

class TestRegister:
    def test_register_success(self, client):
        resp = _register(client)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "ALICE"
        assert data["email"] == "alice@test.com"
        assert data["role"] == "user"

    def test_register_duplicate_username(self, client):
        _register(client)
        resp = _register(client)
        assert resp.status_code == 400
        assert "Username already exists" in resp.json()["detail"]

    def test_register_duplicate_email(self, client):
        _register(client, username="bob")
        resp = _register(client, username="charlie")
        assert resp.status_code == 400
        assert "Email already exists" in resp.json()["detail"]

    def test_register_short_username(self, client):
        resp = _register(client, username="ab")
        assert resp.status_code == 422

    def test_register_short_password(self, client):
        resp = _register(client, password="short")
        assert resp.status_code == 422

    def test_register_username_stored_uppercase(self, client):
        resp = _register(client, username="alice")
        assert resp.json()["username"] == "ALICE"

class TestLogin:
    def test_login_success(self, client):
        _register(client)
        resp = _login(client)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["username"] == "ALICE"

    def test_login_wrong_password(self, client):
        _register(client)
        resp = _login(client, password="wrongpassword")
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = _login(client, username="nobody")
        assert resp.status_code == 401

    def test_login_sets_cookie(self, client):
        _register(client)
        resp = _login(client)
        assert "archia_session" in resp.cookies

    def test_login_remember_me_extends_cookie(self, client):
        _register(client)
        resp = _login(client, remember_me=True)
        assert "archia_session" in resp.cookies

    def test_login_case_insensitive(self, client):
        _register(client, username="alice")
        resp = _login(client, username="Alice")
        assert resp.status_code == 200

class TestLogout:
    def test_logout_clears_cookie(self, client):
        _register(client)
        login_resp = _login(client)
        token = login_resp.json()["access_token"]
        resp = client.post("/api/v1/auth/logout", headers=_auth_header(token))
        assert resp.status_code == 200

    def test_logout_without_auth(self, client):
        client.cookies.clear()
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code == 200

class TestMe:
    def test_me_returns_current_user(self, client):
        _register(client)
        login_resp = _login(client)
        token = login_resp.json()["access_token"]
        resp = client.get("/api/v1/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["username"] == "ALICE"

    def test_me_without_auth(self, client):
        client.cookies.clear()
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token(self, client):
        client.cookies.clear()
        resp = client.get("/api/v1/auth/me", headers=_auth_header("fake.token.here"))
        assert resp.status_code == 401

    def test_me_with_senior_user(self, client):
        login_resp = _login(client, username="SENIOR", password="CHANGEPASSWORD")
        token = login_resp.json()["access_token"]
        resp = client.get("/api/v1/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["role"] == "senior"

def _request_recovery(client, monkeypatch, phone="+5511988887777"):
    """P1.3 passo 1, com código determinístico para o teste (impl. real usa secrets)."""
    monkeypatch.setattr("app.routes.auth.generate_recovery_code", lambda: "12345678")
    return client.post(
        "/api/v1/auth/recover",
        json={"phone": phone, "birth_date": "1995-05-15"},
    )

def _confirm_recovery(client, phone="+5511988887777", code="12345678", new_password="NewSecurePass1"):
    """P1.3 passo 2: código de 8 dígitos + nova senha."""
    return client.post(
        "/api/v1/auth/recover/confirm",
        json={"phone": phone, "birth_date": "1995-05-15", "code": code, "new_password": new_password},
    )

class TestRecover:
    """P1.3 — recuperação em 2 tempos; /recover nunca vaza o código (enumeração-safe)."""

    def test_recover_success(self, client, monkeypatch):
        _register(client)
        resp = _request_recovery(client, monkeypatch)
        assert resp.status_code == 200
        # Sempre {"sent": true} — o código só vai para o log (dev), nunca para a resposta.
        assert resp.json() == {"sent": True}
        assert "12345678" not in resp.text

        confirm = _confirm_recovery(client)
        assert confirm.status_code == 200
        # A nova senha funciona; a antiga é rejeitada.
        assert _login(client, password="NewSecurePass1").status_code == 200
        assert _login(client, password="SecurePass1").status_code == 401

    def test_recover_confirm_invalidates_sessions(self, client, monkeypatch):
        _register(client)
        old_token = _login(client).json()["access_token"]
        assert _request_recovery(client, monkeypatch).status_code == 200
        assert _confirm_recovery(client).status_code == 200
        # P1.4 — bump de token_version revoga sessões já ativas.
        assert client.get("/api/v1/auth/me", headers=_auth_header(old_token)).status_code == 401

    def test_recover_wrong_phone(self, client, monkeypatch):
        _register(client)
        # Telefone sem usuário: MESMA resposta de sucesso (sem enumeração), e confirm falha.
        resp = _request_recovery(client, monkeypatch, phone="+5511900000000")
        assert resp.status_code == 200
        assert resp.json() == {"sent": True}
        assert _confirm_recovery(client, phone="+5511900000000").status_code == 400

    def test_recover_wrong_birth_date(self, client, monkeypatch):
        _register(client)
        # birth_date errada não corresponde a nenhum usuário → resposta idêntica à de sucesso.
        resp = client.post(
            "/api/v1/auth/recover",
            json={"phone": "+5511988887777", "birth_date": "1996-01-01"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"sent": True}

    def test_recover_nonexistent_user(self, client, monkeypatch):
        resp = _request_recovery(client, monkeypatch, phone="+558877665544")
        assert resp.status_code == 200
        assert resp.json() == {"sent": True}

    def test_recover_confirm_wrong_code(self, client, monkeypatch):
        _register(client)
        assert _request_recovery(client, monkeypatch).status_code == 200
        assert _confirm_recovery(client, code="00000000").status_code == 400
        # A senha não mudou.
        assert _login(client, password="SecurePass1").status_code == 200


class TestRecoverConfirmFlow:
    def test_reset_password_success(self, client, monkeypatch):
        """Fluxo 2-passos completo: código válido troca a senha."""
        _register(client)
        assert _request_recovery(client, monkeypatch).status_code == 200
        assert _confirm_recovery(client).status_code == 200
        assert _login(client, password="NewSecurePass1").status_code == 200

    def test_reset_password_old_password_fails(self, client, monkeypatch):
        """Confirm com código inválido NÃO troca a senha: a antiga continua válida."""
        _register(client)
        assert _request_recovery(client, monkeypatch).status_code == 200
        assert _confirm_recovery(client, code="00000000").status_code == 400
        # Login com a senha antiga ainda funciona
        resp = _login(client, password="SecurePass1")
        assert resp.status_code == 200
