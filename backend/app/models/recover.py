"""Código de recuperação de senha (fluxo 2-passos — P1.3).

O código numérico de 8 dígitos nunca é persistido em claro: apenas seu
SHA-256. Cada código expira em 15 min e só pode ser consumido uma vez.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, false
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # SHA-256 hex do código de 8 dígitos — o código em claro não é armazenado.
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    def __repr__(self) -> str:
        return f"<PasswordResetCode(user_id={self.user_id}, used={self.used})>"
