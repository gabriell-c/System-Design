"""Property/fuzz tests for Pydantic schemas: edge cases for username, email, password, intervals."""

import pytest
from pydantic import ValidationError

from app.schemas.user import (
    PasswordRecoveryRequest,
    PasswordReset,
    UserCreate,
    UserLogin,
    UserProfileUpdate,
    UserUpdate,
)


class TestUsernameEdgeCases:
    def test_exactly_3_chars(self):
        u = UserCreate(username="abc", email="a@b.com", password="ValidPass1")
        assert u.username == "ABC"

    def test_2_chars_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="ab", email="a@b.com", password="validpass1")

    def test_1_char_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="a", email="a@b.com", password="validpass1")

    def test_empty_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="", email="a@b.com", password="validpass1")

    def test_very_long_username(self):
        u = UserCreate(username="a" * 50, email="a@b.com", password="ValidPass1")
        assert len(u.username) == 50

    def test_all_uppercase(self):
        u = UserCreate(username="ABC", email="a@b.com", password="ValidPass1")
        assert u.username == "ABC"

    def test_lowercase_converted(self):
        u = UserCreate(username="abc", email="a@b.com", password="ValidPass1")
        assert u.username == "ABC"

    def test_mixed_case_converted(self):
        u = UserCreate(username="AbC", email="a@b.com", password="ValidPass1")
        assert u.username == "ABC"

    def test_digits_only_valid(self):
        u = UserCreate(username="12345", email="a@b.com", password="ValidPass1")
        assert u.username == "12345"

    def test_special_chars_rejected(self):
        for ch in ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
                    "-", "_", "+", "=", " "]:
            with pytest.raises(ValidationError):
                UserCreate(username=f"ab{ch}", email="a@b.com", password="validpass1")

    def test_unicode_alnum_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc\u00e9", email="a@b.com", password="validpass1")

    def test_dot_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="a.b", email="a@b.com", password="validpass1")

    def test_underscore_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="a_b", email="a@b.com", password="validpass1")

class TestPasswordEdgeCases:
    def test_exactly_8_chars_valid(self):
        u = UserCreate(username="abc", email="a@b.com", password="Abcdefg1")
        assert u.password == "Abcdefg1"

    def test_7_chars_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="Abcde1")

    def test_empty_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="")

    def test_very_long_password(self):
        pw = "A" + "a" * 999
        u = UserCreate(username="abc", email="a@b.com", password=pw)
        assert len(u.password) == 1000

    def test_only_lowercase_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="alllowercase")

    def test_only_uppercase_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="ALLUPPERCASE")

    def test_only_digits_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="12345678")

    def test_only_special_chars_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="!@#$%^&*")

    def test_whitespace_valid(self):
        u = UserCreate(username="abc", email="a@b.com", password="Pass word")
        assert u.password == "Pass word"

    def test_only_spaces_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password="        ")

    def test_none_password_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="a@b.com", password=None)

class TestEmailEdgeCases:
    def test_valid_email(self):
        u = UserCreate(username="abc", email="test@example.com", password="ValidPass1")
        assert u.email == "test@example.com"

    def test_empty_email_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(username="abc", email="", password="ValidPass1")

    def test_email_with_plus(self):
        u = UserCreate(username="abc", email="test+tag@example.com", password="ValidPass1")
        assert u.email == "test+tag@example.com"

    def test_email_with_dots(self):
        u = UserCreate(username="abc", email="first.last@example.com", password="ValidPass1")
        assert u.email == "first.last@example.com"

    def test_long_email(self):
        u = UserCreate(username="abc", email="a" * 100 + "@example.com", password="ValidPass1")
        assert len(u.email) > 100

class TestIntervalEdgeCases:
    def test_valid_intervals(self):
        for interval in [0, 5, 15, 30, 60]:
            u = UserProfileUpdate(auto_save_interval_minutes=interval)
            assert u.auto_save_interval_minutes == interval

    def test_invalid_intervals_rejected_by_schema(self):
        for interval in [1, 2, 3, 4, 6, 7, 10, 12, 20, 25, 45, 59, 61, 90, 120]:
            with pytest.raises(ValidationError):
                UserProfileUpdate(auto_save_interval_minutes=interval)

    def test_negative_interval_rejected(self):
        with pytest.raises(ValidationError):
            UserProfileUpdate(auto_save_interval_minutes=-5)

    def test_large_interval_rejected(self):
        with pytest.raises(ValidationError):
            UserProfileUpdate(auto_save_interval_minutes=99999)

    def test_none_interval(self):
        u = UserProfileUpdate(auto_save_interval_minutes=None)
        assert u.auto_save_interval_minutes is None

class TestUserUpdateEdgeCases:
    def test_role_valid_values(self):
        for role in ["user", "senior"]:
            u = UserUpdate(role=role)
            assert u.role == role

    def test_role_none(self):
        u = UserUpdate(role=None)
        assert u.role is None

    def test_empty_update(self):
        u = UserUpdate()
        assert u.username is None
        assert u.email is None
        assert u.phone is None
        assert u.birth_date is None
        assert u.role is None

class TestLoginEdgeCases:
    def test_remember_me_true(self):
        u = UserLogin(username="test", password="pass1234", remember_me=True)
        assert u.remember_me is True

    def test_remember_me_default(self):
        u = UserLogin(username="test", password="pass1234")
        assert u.remember_me is False

class TestPasswordRecoveryEdgeCases:
    def test_valid_recovery(self):
        r = PasswordRecoveryRequest(
            username="test", phone="+5511999999999", birth_date="1990-01-01"
        )
        assert r.username == "test"

    def test_empty_fields_rejected(self):
        with pytest.raises(ValidationError):
            PasswordRecoveryRequest(username="", phone="", birth_date="")

    def test_invalid_phone_rejected(self):
        with pytest.raises(ValidationError):
            PasswordRecoveryRequest(
                username="test", phone="abc", birth_date="1990-01-01"
            )

class TestPasswordResetEdgeCases:
    def test_valid_reset(self):
        r = PasswordReset(token="abc.def.ghi", new_password="NewPassword1")
        assert r.token == "abc.def.ghi"
        assert r.new_password == "NewPassword1"

    def test_empty_token(self):
        r = PasswordReset(token="", new_password="NewPassword1")
        assert r.token == ""
