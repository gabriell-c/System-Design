import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
_PHONE_RE = re.compile(r'^\+?[0-9]{7,15}$')


def _check_password_complexity(v: str) -> str:
    """Validate password complexity: min 8 chars, upper, lower."""
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters')
    if not v.strip():
        raise ValueError('Password cannot be only whitespace')
    if not re.search(r'[A-Z]', v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', v):
        raise ValueError('Password must contain at least one lowercase letter')
    return v


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    phone: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if not v.isascii() or not v.isalnum():
            raise ValueError('Username must be ASCII alphanumeric')
        return v.upper()

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v):
            raise ValueError('Invalid email format')
        return v.lower()

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _PHONE_RE.match(v):
            raise ValueError('Phone must be 7-15 digits, optionally starting with +')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _check_password_complexity(v)


class UserLogin(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class UserUpdate(BaseModel):
    username: str | None = None
    email: str | None = None
    phone: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD
    role: Literal["user", "senior"] | None = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if not v.isascii() or not v.isalnum():
            raise ValueError('Username must be ASCII alphanumeric')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _EMAIL_RE.match(v):
            raise ValueError('Invalid email format')
        return v.lower()


class UserProfileUpdate(BaseModel):
    username: str | None = None
    email: str | None = None
    phone: str | None = None
    birth_date: str | None = None
    auto_save_enabled: bool | None = None
    auto_save_interval_minutes: int | None = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if not v.isascii() or not v.isalnum():
            raise ValueError('Username must be ASCII alphanumeric')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _EMAIL_RE.match(v):
            raise ValueError('Invalid email format')
        return v.lower()

    @field_validator('auto_save_interval_minutes')
    @classmethod
    def validate_interval(cls, v: int | None) -> int | None:
        if v is None:
            return v
        valid_intervals = {0, 5, 15, 30, 60}
        if v not in valid_intervals:
            raise ValueError('Invalid auto-save interval. Must be 0, 5, 15, 30, or 60 minutes.')
        return v


class PasswordRecoveryRequest(BaseModel):
    username: str
    phone: str
    birth_date: str  # YYYY-MM-DD

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError('Phone must be 7-15 digits, optionally starting with +')
        return v


class PasswordReset(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _check_password_complexity(v)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    phone: str | None = None
    birth_date: str | None = None
    auto_save_enabled: bool = True
    auto_save_interval_minutes: int = 15
    created_at: datetime
    updated_at: datetime

    @field_validator("birth_date", mode="before")
    @classmethod
    def format_birth_date(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.strftime("%Y-%m-%d")
        return str(v)
