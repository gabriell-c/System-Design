"""Integration tests for profile routes: get, update, delete account."""


def _register(client, username="alice", email="alice@test.com"):
    return client.post("/auth/register", json={
        "username": username, "email": email, "password": "SecurePass1",
        "phone": "+5511988887777", "birth_date": "1995-05-15"
    })

def _login(client, username="alice", password="SecurePass1"):
    resp = client.post("/auth/login", json={
        "username": username, "password": password
    })
    return resp.json()["access_token"]

def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}

class TestGetProfile:
    def test_get_profile_success(self, client):
        _register(client)
        token = _login(client)
        resp = client.get("/profile/", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "ALICE"
        assert data["email"] == "alice@test.com"
        assert data["role"] == "user"

    def test_get_profile_no_auth(self, client):
        resp = client.get("/profile/")
        assert resp.status_code == 401

    def test_get_profile_invalid_token(self, client):
        resp = client.get("/profile/", headers=_auth_header("bad.token.here"))
        assert resp.status_code == 401

    def test_get_profile_senior_user(self, client):
        token = _login(client, username="SENIOR", password="CHANGEPASSWORD")
        resp = client.get("/profile/", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["role"] == "senior"

class TestUpdateProfile:
    def test_update_email(self, client):
        _register(client)
        token = _login(client)
        resp = client.put(
            "/profile/", json={"email": "newalice@test.com"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "newalice@test.com"

    def test_update_username(self, client):
        _register(client)
        token = _login(client)
        resp = client.put(
            "/profile/", json={"username": "alice2"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["username"] == "ALICE2"

    def test_update_phone(self, client):
        _register(client)
        token = _login(client)
        resp = client.put(
            "/profile/", json={"phone": "+5511977776666"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["phone"] == "+5511977776666"

    def test_update_auto_save_interval_valid(self, client):
        _register(client)
        token = _login(client)
        for interval in [0, 5, 15, 30, 60]:
            resp = client.put(
                "/profile/", json={"auto_save_interval_minutes": interval},
                headers=_auth_header(token)
            )
            assert resp.status_code == 200
            assert resp.json()["auto_save_interval_minutes"] == interval

    def test_update_auto_save_interval_invalid(self, client):
        _register(client)
        token = _login(client)
        resp = client.put(
            "/profile/", json={"auto_save_interval_minutes": 7},
            headers=_auth_header(token)
        )
        assert resp.status_code == 422

    def test_update_auto_save_enabled(self, client):
        _register(client)
        token = _login(client)
        resp = client.put(
            "/profile/", json={"auto_save_enabled": False},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["auto_save_enabled"] is False

    def test_update_birth_date(self, client):
        _register(client)
        token = _login(client)
        resp = client.put(
            "/profile/", json={"birth_date": "1988-03-22"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 200
        assert resp.json()["birth_date"] == "1988-03-22"

    def test_update_no_auth(self, client):
        resp = client.put("/profile/", json={"email": "x@test.com"})
        assert resp.status_code == 401

    def test_update_username_duplicate(self, client):
        _register(client, username="alice", email="alice@test.com")
        _register(client, username="bob", email="bob@test.com")
        token = _login(client, username="bob", password="SecurePass1")
        resp = client.put(
            "/profile/", json={"username": "alice"},
            headers=_auth_header(token)
        )
        assert resp.status_code == 400

class TestDeleteAccount:
    def test_delete_account_success(self, client):
        _register(client)
        token = _login(client)
        resp = client.delete("/profile/", headers=_auth_header(token))
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

    def test_delete_account_then_gone(self, client):
        _register(client)
        token = _login(client)
        client.delete("/profile/", headers=_auth_header(token))
        resp = client.get("/profile/", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_delete_account_no_auth(self, client):
        resp = client.delete("/profile/")
        assert resp.status_code == 401

    def test_delete_account_senior_can_delete(self, client):
        token = _login(client, username="SENIOR", password="CHANGEPASSWORD")
        resp = client.delete("/profile/", headers=_auth_header(token))
        assert resp.status_code == 200
