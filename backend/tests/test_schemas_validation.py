"""Unit tests for Pydantic schemas: UserCreate, UserLogin, validation edge cases."""
import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate, UserLogin, UserProfileUpdate, UserUpdate


def test_valid_user_create():
    u = UserCreate(username="testuser", email="test@example.com", password="ValidPass123")
    assert u.username == "TESTUSER"


def test_username_min_length():
    with pytest.raises(ValidationError):
        UserCreate(username="ab", email="a@b.com", password="ValidPass123")


def test_username_must_be_alphanumeric():
    with pytest.raises(ValidationError):
        UserCreate(username="user name!", email="a@b.com", password="ValidPass123")


def test_password_min_length():
    with pytest.raises(ValidationError):
        UserCreate(username="validuser", email="a@b.com", password="short")


def test_password_requires_uppercase():
    with pytest.raises(ValidationError):
        UserCreate(username="validuser", email="a@b.com", password="alllowercase")


def test_password_requires_lowercase():
    with pytest.raises(ValidationError):
        UserCreate(username="validuser", email="a@b.com", password="ALLUPPERCASE")


def test_valid_user_login():
    u = UserLogin(username="test", password="Pass1234")
    assert u.remember_me is False


def test_remember_me_default_false():
    u = UserLogin(username="test", password="Pass1234")
    assert u.remember_me is False


def test_profile_update_valid_interval():
    u = UserProfileUpdate(auto_save_interval_minutes=30)
    assert u.auto_save_interval_minutes == 30


def test_user_update_role_literal():
    u = UserUpdate(role="senior")
    assert u.role == "senior"
