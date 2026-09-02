import uuid
from datetime import datetime, timedelta, timezone

import jwt
from pydantic import BaseModel

from app.config import settings

JWT_SECRET = settings.archia_jwt_secret
JWT_ALGORITHM = "HS256"


class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    type: str = "access"
    remember_me: bool = False


def create_access_token(
    user_id: int,
    expires_delta: timedelta = timedelta(days=7),
    remember_me: bool = False
) -> str:
    """Create a JWT access token."""
    if remember_me:
        expires_delta = timedelta(days=7)
    else:
        expires_delta = timedelta(hours=24)

    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + expires_delta,
        "type": "access",
        "jti": str(uuid.uuid4()),
        "remember_me": remember_me
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_expiry(token: str) -> datetime | None:
    """Get the expiration time of a token."""
    payload = decode_token(token)
    if payload:
        exp = payload['exp']
        if isinstance(exp, datetime):
            return exp
        if isinstance(exp, (int, float)):
            return datetime.fromtimestamp(exp, tz=timezone.utc)
        return datetime.fromisoformat(exp)
    return None
