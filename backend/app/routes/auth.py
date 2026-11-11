import hashlib
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import create_access_token, decode_token, hash_password, verify_password
from app.database import get_db
from app.models.recover import PasswordResetCode
from app.models.session import Session as UserSession
from app.models.user import User
from app.rate_limit import (
    rate_limit_login,
    rate_limit_recover_confirm_ip,
    rate_limit_recover_ip,
)
from app.schemas.user import (
    PasswordRecoveryConfirmRequest,
    PasswordRecoveryRequest,
    UserCreate,
    UserLogin,
    UserResponse,
)

logger = logging.getLogger("archia.auth")

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

SESSION_COOKIE_NAME = "archia_session"
SESSION_EXPIRY_DAYS = 7
_IS_PRODUCTION = os.environ.get("ARCHIA_ENV", "development").lower() == "production"
# P1.3 — TTL do código de recuperação (8 dígitos, SHA-256 no banco).
RECOVERY_CODE_TTL_MINUTES = 15


def _parse_birth_date(raw: str) -> datetime:
    """'YYYY-MM-DD' -> datetime UTC (mesma forma em que users.birth_date é guardado)."""
    return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=UTC)


def generate_recovery_code() -> str:
    """Código numérico de 8 dígitos (fácil de ler/teclar) — criptograficamente seguro."""
    return "".join(secrets.choice("0123456789") for _ in range(8))


def hash_recovery_code(code: str) -> str:
    """SHA-256 hex do código — só o hash é persistido, nunca o código em claro."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE_NAME)
) -> User:
    """Get the current authenticated user from Bearer header or session cookie."""
    token = None

    # Prefer explicit Authorization header (API clients / tests).
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        candidate = auth_header[7:].strip()
        if candidate:
            token = candidate

    # Fall back to HttpOnly session cookie (browser).
    if not token and session_token:
        token = session_token

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Decode JWT token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # P1.4 — session invalidation: the token's "tv" claim must match the
    # user's stored token_version (bumped on password change / revocation).
    token_version = int(payload.get("tv", 0) or 0)
    stored_version = int(user.token_version or 0)
    if token_version != stored_version:
        raise HTTPException(
            status_code=401,
            detail="Sessão revogada. Faça login novamente.",
        )

    return user


def get_current_senior_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency that ensures the current user has senior privileges."""
    if current_user.role != "senior":
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Senior role required."
        )
    return current_user


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if username already exists (case-insensitive)
    existing_user = db.query(User).filter(
        User.username == user_data.username.upper()
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Check if email already exists
    existing_email = db.query(User).filter(
        User.email == user_data.email.lower()
    ).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    # Create new user
    new_user = User(
        username=user_data.username.upper(),
        email=user_data.email.lower(),
        password_hash=hash_password(user_data.password),
        role="user",  # New users always get "user" role
        phone=user_data.phone,
        birth_date=datetime.strptime(user_data.birth_date, "%Y-%m-%d").replace(tzinfo=UTC) if user_data.birth_date else None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login")
def login(login_data: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    """Login with username and password."""
    rate_limit_login(request, login_data.username)

    # Find user by username (case-insensitive)
    user = db.query(User).filter(
        User.username == login_data.username.upper()
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Create access token (embeds token_version so revocation works — P1.4)
    access_token = create_access_token(
        user_id=user.id,
        remember_me=login_data.remember_me,
        token_version=int(user.token_version or 0),
    )

    # Set session cookie
    max_age = SESSION_EXPIRY_DAYS * 24 * 60 * 60 if login_data.remember_me else None
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=access_token,
        max_age=max_age,
        expires=datetime.now(UTC) + timedelta(days=SESSION_EXPIRY_DAYS) if login_data.remember_me else None,
        httponly=True,
        secure=_IS_PRODUCTION,
        samesite="lax"
    )

    # Create session record
    session_record = UserSession(
        user_id=user.id,
        token=access_token,
        expires_at=datetime.now(UTC) + timedelta(days=SESSION_EXPIRY_DAYS),
        created_at=datetime.now(UTC)
    )
    db.add(session_record)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "auto_save_enabled": user.auto_save_enabled,
            "auto_save_interval_minutes": user.auto_save_interval_minutes
        }
    }


@router.post("/logout")
def logout(response: Response, db: Session = Depends(get_db), session_token: str | None = Cookie(None, alias=SESSION_COOKIE_NAME)):
    """Logout and clear session."""
    if session_token:
        # Remove session from database
        session_record = db.query(UserSession).filter(
            UserSession.token == session_token
        ).first()
        if session_record:
            db.delete(session_record)
            db.commit()

    # Clear the cookie
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.post("/recover")
def recover_password(recovery_data: PasswordRecoveryRequest, request: Request, db: Session = Depends(get_db)):
    """P1.3 — passo 1 da recuperação em 2 tempos.

    Valida phone+birth_date, gera um código numérico de 8 dígitos (armazenado
    como SHA-256, TTL 15 min) e NUNCA expõe o código na resposta — sempre
    {"sent": true}, inclusive quando não há usuário correspondente, para
    dificultar enumeração de telefones.
    """
    rate_limit_recover_ip(request)

    birth_date = _parse_birth_date(recovery_data.birth_date)
    user = (
        db.query(User)
        .filter(User.phone == recovery_data.phone, User.birth_date == birth_date)
        .first()
    )
    if user:
        code = generate_recovery_code()
        # Códigos anteriores deste usuário deixam de ser válidos.
        db.query(PasswordResetCode).filter(
            PasswordResetCode.user_id == user.id,
            PasswordResetCode.used.is_(False),
        ).update({"used": True}, synchronize_session=False)
        db.add(
            PasswordResetCode(
                user_id=user.id,
                phone=recovery_data.phone,
                code_hash=hash_recovery_code(code),
                used=False,
                created_at=datetime.now(UTC),
                expires_at=datetime.now(UTC) + timedelta(minutes=RECOVERY_CODE_TTL_MINUTES),
            )
        )
        db.commit()
        if _IS_PRODUCTION:
            logger.info("recover_code_dispatched phone=%s", user.phone)
        else:
            # Em dev não há canal de SMS: o código só vai para o log de servidor.
            logger.info("recover_code dev_only phone=%s code=%s", user.phone, code)

    return {"sent": True}


@router.post("/recover/confirm")
def confirm_recovery(
    payload: PasswordRecoveryConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """P1.3 — passo 2: código de 8 dígitos + nova senha.

    Verifica código inusado/não expirado, define a nova senha bcrypt, marca o
    código como usado e incrementa token_version — revogando todas as sessões
    ativas do usuário (P1.4).
    """
    rate_limit_recover_confirm_ip(request)

    birth_date = _parse_birth_date(payload.birth_date)
    user = (
        db.query(User)
        .filter(User.phone == payload.phone, User.birth_date == birth_date)
        .first()
    )
    code_row = (
        db.query(PasswordResetCode)
        .filter(
            PasswordResetCode.phone == payload.phone,
            PasswordResetCode.used.is_(False),
        )
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )

    now = datetime.now(UTC)
    expires_at = code_row.expires_at if code_row is not None else None
    if expires_at is not None and expires_at.tzinfo is None:
        # SQLite devolve datetime sem tz; normaliza para UTC antes do comparativo.
        expires_at = expires_at.replace(tzinfo=UTC)
    valid = (
        user is not None
        and code_row is not None
        and code_row.user_id == user.id
        and expires_at > now
        and code_row.code_hash == hash_recovery_code(payload.code)
    )
    if not valid:
        # Mensagem genérica — não distingue usuário inexistente, código usado
        # ou expirado (evita enumeração).
        raise HTTPException(status_code=400, detail="Código inválido, expirado ou já utilizado.")

    user.password_hash = hash_password(payload.new_password)
    user.token_version = int(user.token_version or 0) + 1  # revoga tokens antigos
    code_row.used = True
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.used.is_(False),
    ).update({"used": True}, synchronize_session=False)
    db.query(UserSession).filter(UserSession.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return {"detail": "Senha redefinida com sucesso. Faça login novamente."}


@router.post("/sessions/invalidate")
def invalidate_all_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """P1.4 — revoga todas as sessões ativas (bump de token_version + limpeza)."""
    current_user.token_version = int(current_user.token_version or 0) + 1
    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"detail": "Todas as sessões foram revogadas."}


@router.get("/sso/config")
def sso_config() -> dict:
    """P1.4.3 — SSO OAuth/SAML configurável via env (stub operacional)."""
    import os

    return {
        "enabled": os.environ.get("ARCHIA_SSO_ENABLED", "false").lower() == "true",
        "provider": os.environ.get("ARCHIA_SSO_PROVIDER", "oidc"),
        "issuer_url": os.environ.get("ARCHIA_SSO_ISSUER_URL", ""),
        "client_id": os.environ.get("ARCHIA_SSO_CLIENT_ID", ""),
        "saml_metadata_url": os.environ.get("ARCHIA_SSO_SAML_METADATA_URL", ""),
        "audit_logging": True,
    }


