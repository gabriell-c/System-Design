from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.user import UserProfileUpdate, UserResponse

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("/", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's profile."""
    return current_user


@router.put("/", response_model=UserResponse)
def update_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's profile."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if profile_update.username is not None:
        # Check if username already exists (case-insensitive)
        existing = db.query(User).filter(
            User.username == profile_update.username.upper()
        ).first()
        if existing and existing.id != user.id:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = profile_update.username.upper()

    if profile_update.email is not None:
        existing = db.query(User).filter(
            User.email == profile_update.email.lower()
        ).first()
        if existing and existing.id != user.id:
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = profile_update.email.lower()

    if profile_update.phone is not None:
        user.phone = profile_update.phone

    if profile_update.birth_date is not None:
        user.birth_date = datetime.strptime(profile_update.birth_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    if profile_update.auto_save_enabled is not None:
        user.auto_save_enabled = profile_update.auto_save_enabled

    if profile_update.auto_save_interval_minutes is not None:
        # Validate interval: 0, 5, 15, 30, 60
        valid_intervals = {0, 5, 15, 30, 60}
        if profile_update.auto_save_interval_minutes not in valid_intervals:
            raise HTTPException(
                status_code=400,
                detail="Invalid auto-save interval. Must be 0, 5, 15, 30, or 60 minutes."
            )
        user.auto_save_interval_minutes = profile_update.auto_save_interval_minutes

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user


@router.delete("/")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete the current user's account."""
    # Delete user
    db.delete(current_user)
    db.commit()

    return {"message": "Account deleted successfully"}
