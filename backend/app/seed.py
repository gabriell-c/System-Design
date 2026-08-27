from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database import _IS_SQLITE, _sqlite_write_lock, engine
from app.models.user import User


def seed_default_users():
    """Create the default SENIOR user if it doesn't exist."""
    lock = _sqlite_write_lock if _IS_SQLITE else None
    if lock:
        lock.acquire()
    try:
        with Session(engine) as db:
            existing = db.query(User).filter(User.username == "SENIOR").first()
            if existing:
                print("SENIOR user already exists.")
                return

            senior_user = User(
                username="SENIOR",
                email="senior@archia.local",
                password_hash=hash_password("CHANGEPASSWORD"),
                role="senior",
                phone="+5511999999999",
                birth_date=datetime.strptime("1990-01-01", "%Y-%m-%d").replace(tzinfo=UTC),
                auto_save_enabled=True,
                auto_save_interval_minutes=15,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            db.add(senior_user)
            db.commit()
            print("SENIOR user created successfully!")
            print("  Username: SENIOR")
            print("  Password: CHANGEPASSWORD")
            print("  Role: senior")
    finally:
        if lock:
            lock.release()


if __name__ == "__main__":
    seed_default_users()
