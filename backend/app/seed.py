from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database import engine
from app.models.user import User


def seed_default_users():
    """Create the default SENIOR user if it doesn't exist."""
    with Session(engine) as db:
        # Check if SENIOR user already exists
        existing = db.query(User).filter(User.username == "SENIOR").first()
        if existing:
            print("SENIOR user already exists.")
            return

        # Create default SENIOR user
        senior_user = User(
            username="SENIOR",
            email="senior@archia.local",
            password_hash=hash_password("CHANGEPASSWORD"),
            role="senior",
            phone="+5511999999999",
            birth_date=datetime.strptime("1990-01-01", "%Y-%m-%d").replace(tzinfo=timezone.utc),
            auto_save_enabled=True,
            auto_save_interval_minutes=15,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

        db.add(senior_user)
        db.commit()
        print("SENIOR user created successfully!")
        print("  Username: SENIOR")
        print("  Password: CHANGEPASSWORD")
        print("  Role: senior")


if __name__ == "__main__":
    seed_default_users()
