"""Integration tests for user CRUD (senior-only routes)."""

import pytest

def _login_senior(client):
    resp = client.post("/auth/login", json={
        "username": "SENIOR", "password": "CHANGEPASSWORD"
    })
    return resp.json()["access_token"]

def _register_user(client, username="alice", email="alice@test.com"):
    client.post("/auth/register", json={
        "username": username, "email": email, "password": "SecurePass1",
        "phone": "+5511988887777", "birth_date": "1995-05-15"
    })

def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}

class TestListUsers:
    def test_list_users_as_senior(self, client):
        token = _login_senior(client)
        _register_user(client)
        resp = client.get("/users/", headers=_auth_header(token))
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) >= 2  # SENIOR + alice

    def test_list_users_requires_senior(self, client):
        _register_user(client)
        login_resp = client.post("/auth/login", json={
            "username": "alice", "password": "SecurePass1"
        })
        token = login_resp.json()["access_token"]
        resp = client.get("/users/", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_list_users_no_auth(self, client):
        resp = client.get("/users/")
        assert resp.status_code == 401

    def test_list_users_returns_user_response_shape(self, client):
        token = _login_senior(client)
        resp = client.get("/users/", headers=_auth_header(token))
        assert resp.status_code == 200
        user = resp.json()[0]
        assert "id" in user
        assert "username" in user
        assert "email" in user
        assert "role" in user

class TestGetUser:
    def test_get_user_by_id(self, client):
        token = _login_senior(client)
        _register_user(client, username="bob", email="bob@test.com")
        list_resp = client.get("/users/", headers=_auth_header(token))
        users = list_resp.json()
        bob = next(u for u in users if u["username"] == "BOB")
        resp = client.get(f"/users/{bob['id']}", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["username"] == "BOB"

    def test_get_user_not_found(self, client):
        token = _login_senior(client)
        resp = client.get("/users/9999", headers=_auth_header(token))
        assert resp.status_code == 404

    def test_get_user_requires_senior(self, client):
        _register_user(client)
        login_resp = client.post("/auth/login", json={
            "username": "alice", "password": "SecurePass1"
        })
        token = login_resp.json()["access_token"]
        resp = client.get("/users/1", headers=_auth_header(token))
        assert resp.status_code == 403

class TestUpdateUser:
    def test_update_user_email(self, client):
        token = _login_senior(client)
        _register_user(client, username="charlie", email="charlie@test.com")
        list_resp = client.get("/users/", headers=_auth_header(token))
        charlie = next(u for u in list_resp.json() if u["username"] == "CHARLIE")
        resp = client.put(
            f"/users/{charlie['id']}",
            json={"email": "charlie_new@test.com"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "charlie_new@test.com"

    def test_update_user_role(self, client):
        token = _login_senior(client)
        _register_user(client, username="dave", email="dave@test.com")
        list_resp = client.get("/users/", headers=_auth_header(token))
        dave = next(u for u in list_resp.json() if u["username"] == "DAVE")
        resp = client.put(
            f"/users/{dave['id']}",
            json={"role": "senior"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "senior"

    def test_update_user_not_found(self, client):
        token = _login_senior(client)
        resp = client.put(
            "/users/9999", json={"email": "x@test.com"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 404

    def test_update_user_requires_senior(self, client):
        _register_user(client)
        login_resp = client.post("/auth/login", json={
            "username": "alice", "password": "SecurePass1"
        })
        token = login_resp.json()["access_token"]
        resp = client.put("/users/1", json={"email": "x@test.com"},
                          headers=_auth_header(token))
        assert resp.status_code == 403

    def test_update_user_duplicate_email(self, client):
        token = _login_senior(client)
        _register_user(client, username="eve", email="eve@test.com")
        _register_user(client, username="frank", email="frank@test.com")
        list_resp = client.get("/users/", headers=_auth_header(token))
        frank = next(u for u in list_resp.json() if u["username"] == "FRANK")
        resp = client.put(
            f"/users/{frank['id']}",
            json={"email": "eve@test.com"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 400

class TestDeleteUser:
    def test_delete_user_success(self, client):
        token = _login_senior(client)
        _register_user(client, username="grace", email="grace@test.com")
        list_resp = client.get("/users/", headers=_auth_header(token))
        grace = next(u for u in list_resp.json() if u["username"] == "GRACE")
        resp = client.delete(f"/users/{grace['id']}", headers=_auth_header(token))
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

    def test_delete_user_cannot_delete_self(self, client):
        token = _login_senior(client)
        list_resp = client.get("/users/", headers=_auth_header(token))
        senior = next(u for u in list_resp.json() if u["username"] == "SENIOR")
        resp = client.delete(f"/users/{senior['id']}", headers=_auth_header(token))
        assert resp.status_code == 400
        assert "cannot delete your own" in resp.json()["detail"].lower()

    def test_delete_user_not_found(self, client):
        token = _login_senior(client)
        resp = client.delete("/users/9999", headers=_auth_header(token))
        assert resp.status_code == 404

    def test_delete_user_requires_senior(self, client):
        _register_user(client)
        login_resp = client.post("/auth/login", json={
            "username": "alice", "password": "SecurePass1"
        })
        token = login_resp.json()["access_token"]
        resp = client.delete("/users/1", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_delete_user_then_gone(self, client):
        token = _login_senior(client)
        _register_user(client, username="hal", email="hal@test.com")
        list_resp = client.get("/users/", headers=_auth_header(token))
        hal = next(u for u in list_resp.json() if u["username"] == "HAL")
        client.delete(f"/users/{hal['id']}", headers=_auth_header(token))
        resp = client.get(f"/users/{hal['id']}", headers=_auth_header(token))
        assert resp.status_code == 404
