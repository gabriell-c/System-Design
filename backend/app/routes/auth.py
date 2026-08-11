import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import create_access_token, decode_token, hash_password, verify_password
from app.database import get_db
from app.models.session import Session as UserSession
from app.models.user import User
from app.schemas.user import (
    PasswordRecoveryRequest,
    PasswordReset,
    UserCreate,
    UserLogin,
    UserResponse,
)

from app.rate_limit import rate_limit_login, rate_limit_recover

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_COOKIE_NAME = "archia_session"
SESSION_EXPIRY_DAYS = 7
_IS_PRODUCTION = os.environ.get("ARCHIA_ENV", "development").lower() == "production"


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE_NAME)
) -> User:
    """Get the current authenticated user from session cookie or Authorization header."""
    token = None

    # Try session cookie first
    if session_token:
        token = session_token

    # Try Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

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
        birth_date=datetime.strptime(user_data.birth_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) if user_data.birth_date else None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
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

    # Create access token
    access_token = create_access_token(
        user_id=user.id,
        remember_me=login_data.remember_me
    )

    # Set session cookie
    max_age = SESSION_EXPIRY_DAYS * 24 * 60 * 60 if login_data.remember_me else None
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=access_token,
        max_age=max_age,
        expires=datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS) if login_data.remember_me else None,
        httponly=True,
        secure=_IS_PRODUCTION,
        samesite="lax"
    )

    # Create session record
    session_record = UserSession(
        user_id=user.id,
        token=access_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS),
        created_at=datetime.now(timezone.utc)
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
    """Initiate password recovery with username, phone, and birth date."""
    rate_limit_recover(request, recovery_data.username)

    user = db.query(User).filter(
        User.username == recovery_data.username.upper()
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify phone and birth date
    if user.phone != recovery_data.phone:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    if user.birth_date:
        user_birth_date = user.birth_date.strftime("%Y-%m-%d")
        if user_birth_date != recovery_data.birth_date:
            raise HTTPException(status_code=400, detail="Invalid birth date")
    else:
        raise HTTPException(status_code=400, detail="Birth date not configured")

    # Generate reset token
    reset_token = create_access_token(
        user_id=user.id,
        expires_delta=timedelta(hours=24),  # Reset token valid for 24 hours
        remember_me=False
    )

    # Store reset token in session (in a real app, send via SMS/email)
    session_record = UserSession(
        user_id=user.id,
        token=reset_token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        created_at=datetime.now(timezone.utc)
    )
    db.add(session_record)
    db.commit()

    # For demo purposes, return token (in production, send via SMS/email)
    return {
        "message": "Password recovery initiated",
        "reset_token": reset_token,  # In production, this would be sent via SMS/email
        "expires_in": 86400  # 24 hours
    }


@router.post("/reset-password")
def reset_password(reset_data: PasswordReset, db: Session = Depends(get_db)):
    """Reset password using the recovery token."""
    # Decode the reset token
    payload = decode_token(reset_data.token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = int(payload["sub"])

    # Verify the token exists in sessions (and hasn't been used)
    session_record = db.query(UserSession).filter(
        UserSession.token == reset_data.token,
        UserSession.user_id == user_id
    ).first()

    if not session_record:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    # Update password
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(reset_data.new_password)
    user.updated_at = datetime.now(timezone.utc)

    # Invalidate ALL sessions for this user (security: old tokens become useless)
    db.query(UserSession).filter(UserSession.user_id == user_id).delete()

    db.commit()

    return {"message": "Password reset successfully"}
