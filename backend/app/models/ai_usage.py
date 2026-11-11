from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AiUsage(Base):
    """Orçamento diário de análise por IA, durável em SQLite (item 30).

    Uma linha por (user_id, dia UTC). Persistir em vez de manter em memória
    garante que reinícios do processo e múltiplos workers respeitam o mesmo
    teto. `day` é "YYYY-MM-DD" em UTC — mesma base de cálculo do limite.
    """

    __tablename__ = "ai_usage"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    analyze_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    auto_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
