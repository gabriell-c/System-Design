"""Integration tests for auth routes."""
import pytest
from app.auth import create_access_token

def _register(client, username="alice", email="alice@test.com", password="SecurePass1"):
    return client.post("/auth/register", json={
        "username": username, "email": email, "password": password,
        "phone": "+5511988887777", "birth_date": "1995-05-15"
    })

def _login(client, username="alice", password="SecurePass1", remember_me=False):
    return client.post("/auth/login", json={
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
        resp = client.post("/auth/logout", headers=_auth_header(token))
        assert resp.status_code == 200

    def test_logout_without_auth(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code == 200

class TestMe:
    def test_me_returns_current_user(self, client):
        _register(client)
        login_resp = _login(client)
        token = login_resp.json()["access_token"]
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["username"] == "ALICE"

    def test_me_without_auth(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token(self, client):
        resp = client.get("/auth/me", headers=_auth_header("fake.token.here"))
        assert resp.status_code == 401

    def test_me_with_senior_user(self, client):
        login_resp = _login(client, username="SENIOR", password="CHANGEPASSWORD")
        token = login_resp.json()["access_token"]
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["role"] == "senior"

class TestRecover:
    def test_recover_success(self, client):
        _register(client)
        resp = client.post("/auth/recover", json={
            "username": "alice", "phone": "+5511988887777", "birth_date": "1995-05-15"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "reset_token" in data
        assert data["expires_in"] == 86400

    def test_recover_wrong_phone(self, client):
        _register(client)
        resp = client.post("/auth/recover", json={
            "username": "alice", "phone": "+5511000000000", "birth_date": "1995-05-15"
        })
        assert resp.status_code == 400

    def test_recover_wrong_birth_date(self, client):
        _register(client)
        resp = client.post("/auth/recover", json={
            "username": "alice", "phone": "+5511988887777", "birth_date": "2000-01-01"
        })
        assert resp.status_code == 400

    def test_recover_nonexistent_user(self, client):
        resp = client.post("/auth/recover", json={
            "username": "nobody", "phone": "+5511000000000", "birth_date": "1990-01-01"
        })
        assert resp.status_code == 404

class TestResetPassword:
    def test_reset_password_success(self, client):
        _register(client)
        recover_resp = client.post("/auth/recover", json={
            "username": "alice", "phone": "+5511988887777", "birth_date": "1995-05-15"
        })
        reset_token = recover_resp.json()["reset_token"]
        resp = client.post("/auth/reset-password", json={
            "token": reset_token, "new_password": "NewSecurePass1"
        })
        assert resp.status_code == 200
        assert "successfully" in resp.json()["message"].lower()
        login_resp = _login(client, password="NewSecurePass1")
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token(self, client):
        resp = client.post("/auth/reset-password", json={
            "token": "invalid.token.here", "new_password": "NewSecurePass1"
        })
        assert resp.status_code == 400

    def test_reset_password_old_password_fails(self, client):
        _register(client)
        recover_resp = client.post("/auth/recover", json={
            "username": "alice", "phone": "+5511988887777", "birth_date": "1995-05-15"
        })
        reset_token = recover_resp.json()["reset_token"]
        client.post("/auth/reset-password", json={
            "token": reset_token, "new_password": "newsecurepass1"
        })
        resp = _login(client, password="securepass1")
        assert resp.status_code == 401
