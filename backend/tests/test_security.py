"""Security tests: auth bypass, invalid tokens, role escalation, JWT validation."""

import jwt as pyjwt
from datetime import datetime, timedelta

SECRET = "archia-secret-key-change-in-production"

def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}

def _register_and_login(client, username="alice", email="alice@test.com"):
    client.post("/auth/register", json={
        "username": username, "email": email, "password": "SecurePass1",
        "phone": "+5511988887777", "birth_date": "1995-05-15"
    })
    resp = client.post("/auth/login", json={
        "username": username, "password": "SecurePass1"
    })
    return resp.json()["access_token"]

class TestAuthBypass:
    def test_empty_header(self, client):
        resp = client.get("/auth/me", headers={"Authorization": ""})
        assert resp.status_code == 401

    def test_bearer_only(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer"})
        assert resp.status_code == 401

    def test_no_scheme(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "token123"})
        assert resp.status_code == 401

    def test_empty_cookie(self, client):
        client.cookies.set("archia_session", "")
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_valid_token_works(self, client):
        token = _register_and_login(client)
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200

class TestInvalidTokens:
    def test_random_string(self, client):
        resp = client.get("/auth/me", headers=_auth_header("eyJhbGciOiJIUzI1NiJ9.random"))
        assert resp.status_code == 401

    def test_empty_token(self, client):
        resp = client.get("/auth/me", headers=_auth_header(""))
        assert resp.status_code == 401

    def test_wrong_algorithm(self, client):
        payload = {"sub": "1", "exp": datetime.utcnow() + timedelta(hours=1), "type": "access"}
        token = pyjwt.encode(payload, SECRET, algorithm="HS384")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_wrong_secret(self, client):
        payload = {"sub": "1", "exp": datetime.utcnow() + timedelta(hours=1), "type": "access"}
        token = pyjwt.encode(payload, "wrong-secret-key", algorithm="HS256")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_expired(self, client):
        payload = {"sub": "1", "exp": datetime.utcnow() - timedelta(hours=1), "type": "access"}
        token = pyjwt.encode(payload, SECRET, algorithm="HS256")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_nonexistent_user(self, client):
        payload = {"sub": "99999", "exp": datetime.utcnow() + timedelta(hours=1), "type": "access"}
        token = pyjwt.encode(payload, SECRET, algorithm="HS256")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

class TestRoleEscalation:
    def test_user_cannot_list_users(self, client):
        token = _register_and_login(client)
        resp = client.get("/users/", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_user_cannot_get_user_by_id(self, client):
        token = _register_and_login(client)
        resp = client.get("/users/1", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_user_cannot_update_user(self, client):
        token = _register_and_login(client)
        resp = client.put("/users/1", json={"role": "senior"},
                          headers=_auth_header(token))
        assert resp.status_code == 403

    def test_user_cannot_delete_user(self, client):
        token = _register_and_login(client)
        resp = client.delete("/users/1", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_profile_cannot_escalate_role(self, client):
        token = _register_and_login(client)
        resp = client.put(
            "/profile/", json={"role": "senior"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        me_resp = client.get("/auth/me", headers=_auth_header(token))
        assert me_resp.json()["role"] == "user"

class TestJwtValidation:
    def test_missing_sub_raises(self, client):
        payload = {"exp": datetime.utcnow() + timedelta(hours=1), "type": "access"}
        token = pyjwt.encode(payload, SECRET, algorithm="HS256")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_non_numeric_sub_raises(self, client):
        payload = {"sub": "abc", "exp": datetime.utcnow() + timedelta(hours=1), "type": "access"}
        token = pyjwt.encode(payload, SECRET, algorithm="HS256")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_no_exp_token_works(self, client):
        payload = {"sub": "1", "type": "access"}
        token = pyjwt.encode(payload, SECRET, algorithm="HS256")
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200

    def test_payload_integrity(self, client):
        token = _register_and_login(client)
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["username"] == "ALICE"

    def test_token_reusable(self, client):
        token = _register_and_login(client)
        for _ in range(3):
            resp = client.get("/auth/me", headers=_auth_header(token))
            assert resp.status_code == 200
