"""Orçamento diário de análise por IA, durável em SQLite (item 30).

Os tetos NOMEADOS vivem em `app.rate_limit` (`LLM_DAILY_ANALYZE_BUDGET` e
`AUTO_ANALYZE_DAILY_BUDGET`); aqui está o enforcement em tabela
(`ai_usage`), que sobrevive a reinícios e funciona com múltiplos workers —
o contador em memória antigo não garantia nem um nem outro.
"""

from __future__ import annotations

import time

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import rate_limit
from app.models.ai_usage import AiUsage

# Detalhes exatos dos 429 (a UI reage a cada um; auto ≠ manual).
MANUAL_ANALYZE_BUDGET_DETAIL = "Orçamento diário de análises esgotado"
AUTO_ANALYZE_BUDGET_DETAIL = "Orçamento diário de auto-análise esgotado"


def current_utc_day() -> str:
    """Dia UTC corrente (YYYY-MM-DD) — mesma base de cálculo do teto."""
    return time.strftime("%Y-%m-%d", time.gmtime())


def _get_or_create_usage(db: Session, user_id: int, day: str) -> AiUsage:
    row = db.get(AiUsage, (user_id, day))
    if row is None:
        row = AiUsage(user_id=user_id, day=day)
        db.add(row)
        db.commit()
    return row


def check_and_consume_analyze(db: Session, user_id: int, is_auto: bool = False) -> None:
    """Consome 1 do orçamento diário do usuário; 429 ao estourar o teto.

    Manual (análise via endpoint) e auto (análise agendada) usam contadores
    e tetos separados; o teto é lido no momento da chamada, então o
    monkeypatch dos testes continua valendo.
    """
    day = current_utc_day()
    row = _get_or_create_usage(db, user_id, day)
    limit = rate_limit.AUTO_ANALYZE_DAILY_BUDGET if is_auto else rate_limit.LLM_DAILY_ANALYZE_BUDGET
    used = row.auto_count if is_auto else row.analyze_count
    if used >= limit:
        detail = AUTO_ANALYZE_BUDGET_DETAIL if is_auto else MANUAL_ANALYZE_BUDGET_DETAIL
        raise HTTPException(status_code=429, detail=detail)
    if is_auto:
        row.auto_count = used + 1
    else:
        row.analyze_count = used + 1
    db.commit()


def record_llm_usage(db: Session, user_id: int, llm_calls: int, tokens_in: int = 0, tokens_out: int = 0) -> None:
    """Acumula uso real de LLM após uma execução (tokens podem ser 0)."""
    row = _get_or_create_usage(db, user_id, current_utc_day())
    row.llm_calls += llm_calls
    row.tokens_in += tokens_in
    row.tokens_out += tokens_out
    db.commit()


def ai_usage_summary(db: Session, user_id: int) -> dict:
    """Resumo do dia p/ GET /settings/ai/usage (item 41): shape exato da UI.

    Leitura pura — não cria linha (consumo só vem via check_and_consume/record).
    """
    day = current_utc_day()
    row = db.get(AiUsage, (user_id, day))
    return {
        "day": day,
        "analyze_used": row.analyze_count if row else 0,
        "auto_used": row.auto_count if row else 0,
        "llm_calls": row.llm_calls if row else 0,
        "limit": rate_limit.LLM_DAILY_ANALYZE_BUDGET,
        "auto_limit": rate_limit.AUTO_ANALYZE_DAILY_BUDGET,
    }
