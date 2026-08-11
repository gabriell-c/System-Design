from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AiSettings(Base):
    """Configuração global de provedor de IA (linha única id=default)."""

    __tablename__ = "ai_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="omniroute")
    base_url: Mapped[str] = mapped_column(String(500), nullable=False, default="http://localhost:20128/v1")
    api_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model: Mapped[str] = mapped_column(String(120), nullable=False, default="auto/coding")
    enabled: Mapped[str] = mapped_column(String(8), nullable=False, default="true")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
