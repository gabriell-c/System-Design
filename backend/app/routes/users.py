from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.auth import get_current_senior_user
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
def list_users(
    current_user: User = Depends(get_current_senior_user),
    db: Session = Depends(get_db)
):
    """List all users (senior only)."""
    return db.query(User).order_by(User.id).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_senior_user),
    db: Session = Depends(get_db)
):
    """Get a specific user by ID (senior only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_senior_user),
    db: Session = Depends(get_db)
):
    """Update a user by ID (senior only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.username is not None:
        # Check if username already exists (case-insensitive)
        existing = db.query(User).filter(
            User.username == user_update.username.upper()
        ).first()
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = user_update.username.upper()

    if user_update.email is not None:
        existing = db.query(User).filter(
            User.email == user_update.email.lower()
        ).first()
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = user_update.email.lower()

    if user_update.phone is not None:
        user.phone = user_update.phone

    if user_update.birth_date is not None:
        user.birth_date = datetime.strptime(user_update.birth_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    if user_update.role is not None:
        user.role = user_update.role

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_senior_user),
    db: Session = Depends(get_db)
):
    """Delete a user by ID (senior only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": f"User {user.username} deleted successfully"}
