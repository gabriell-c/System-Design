"""API versioning + observability smoke (Phase 1)."""


def test_correlation_id_header_roundtrip(client):
    r = client.get("/api/health", headers={"X-Request-ID": "cid-test-123"})
    assert r.status_code == 200
    assert r.headers.get("X-Request-ID") == "cid-test-123"


def test_legacy_auth_path_rewrites_with_deprecation(client):
    r = client.post(
        "/auth/login",
        json={"username": "nope", "password": "wrong"},
    )
    assert r.status_code == 401
    assert r.headers.get("Deprecation") == "true"
    assert "successor-version" in (r.headers.get("Link") or "")


def test_versioned_auth_path_has_no_deprecation(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"username": "nope", "password": "wrong"},
    )
    assert r.status_code == 401
    assert r.headers.get("Deprecation") is None
