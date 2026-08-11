"""Unit tests for auth security: JWT, password hashing, token validation."""
from datetime import datetime, timedelta, timezone

import jwt as pyjwt

from app.auth.jwt import create_access_token, decode_token, get_token_expiry
from app.auth.security import hash_password, verify_password


def test_hash_and_verify_password():
    pw = "MySecurePass123"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("WrongPassword", hashed)


def test_hash_different_each_time():
    h1 = hash_password("same_password")
    h2 = hash_password("same_password")
    assert h1 != h2


def test_create_and_decode_token():
    token = create_access_token(user_id=42, remember_me=False)
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "access"
    assert payload["remember_me"] is False


def _exp_to_naive(exp):
    if isinstance(exp, (int, float)):
        return datetime.utcfromtimestamp(exp)
    if isinstance(exp, str):
        return datetime.fromisoformat(exp)
    return exp.replace(tzinfo=None)


def test_remember_me_token_long_expiry():
    token = create_access_token(user_id=1, remember_me=True)
    payload = decode_token(token)
    assert payload["remember_me"] is True
    exp = _exp_to_naive(payload["exp"])
    now = datetime.utcnow()
    delta = exp - now
    assert delta.days >= 6


def test_regular_token_short_expiry():
    token = create_access_token(user_id=1, remember_me=False)
    payload = decode_token(token)
    exp = _exp_to_naive(payload["exp"])
    now = datetime.utcnow()
    delta = exp - now
    assert delta.days <= 1


def test_decode_invalid_token_returns_none():
    assert decode_token("totally.bogus.token") is None


def test_decode_tampered_token_returns_none():
    token = create_access_token(user_id=1)
    parts = token.split(".")
    parts[2] = "AAAA" + parts[2][4:]
    assert decode_token(".".join(parts)) is None


def test_decode_token_with_wrong_secret():
    payload = {
        "sub": "1",
        "exp": datetime.utcnow() + timedelta(hours=1),
        "type": "access",
        "jti": "fake",
        "remember_me": False,
    }
    token = pyjwt.encode(payload, "wrong-secret", algorithm="HS256")
    assert decode_token(token) is None


def test_get_token_expiry_valid():
    token = create_access_token(user_id=5)
    expiry = get_token_expiry(token)
    assert expiry is not None
    assert expiry > datetime.now(timezone.utc)


def test_get_token_expiry_invalid():
    assert get_token_expiry("invalid.token.here") is None
