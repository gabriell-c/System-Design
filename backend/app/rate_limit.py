"""In-memory rate limiter for auth and expensive endpoints.

Hardening (P1.10):
- `_buckets` is bounded (~10k keys) and swept lazily + periodically, so a
  flood of unique IPs cannot exhaust memory.
- Named daily LLM analyze budgets (P1.9c / item 30); enforcement is durable
  in SQLite via `app.services.ai_usage`.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any

from fastapi import HTTPException, Request

# Store: {key: [timestamps]}
_buckets: dict[str, list[float]] = defaultdict(list)
_lock = threading.Lock()

# Hard cap on tracked keys to bound memory under IP flooding.
MAX_TRACKED_KEYS = 10_000
# Buckets whose last hit is older than this are considered expired.
_BUCKET_TTL_S = 30 * 60
_SWEEP_INTERVAL_S = 5 * 60
_last_sweep = 0.0


def sweep_expired_buckets(now: float | None = None) -> int:
    """Drop expired buckets and enforce the size cap. Returns keys removed."""
    global _last_sweep
    now = now if now is not None else time.time()
    with _lock:
        removed = 0
        for key in [k for k, v in _buckets.items() if not v or v[-1] < now - _BUCKET_TTL_S]:
            del _buckets[key]
            removed += 1
        if len(_buckets) > MAX_TRACKED_KEYS:
            # Over cap: evict least-recently-active keys first.
            oldest = sorted(
                (k for k, v in _buckets.items() if v),
                key=lambda k: _buckets[k][-1],
            )
            for key in oldest[: len(_buckets) - MAX_TRACKED_KEYS]:
                del _buckets[key]
                removed += 1
        _last_sweep = now
        return removed


def _maybe_sweep() -> None:
    """Lazy sweep: runs at most every _SWEEP_INTERVAL_S or when over cap."""
    now = time.time()
    if now - _last_sweep >= _SWEEP_INTERVAL_S or len(_buckets) >= MAX_TRACKED_KEYS:
        sweep_expired_buckets(now)


def reset_rate_limiter() -> None:
    """Reset all state (used by tests)."""
    global _last_sweep
    with _lock:
        _buckets.clear()
        _last_sweep = 0.0


def _rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Raise 429 if max_attempts exceeded within window_seconds."""
    now = time.time()
    cutoff = now - window_seconds
    _maybe_sweep()
    with _lock:
        _buckets[key] = [t for t in _buckets[key] if t > cutoff]
        if len(_buckets[key]) >= max_attempts:
            # Retry-After (item 11): cliente sabe quando tentar de novo.
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Try again in {window_seconds} seconds.",
                headers={"Retry-After": str(window_seconds)},
            )
        _buckets[key].append(now)


def rate_limit_login(request: Request, username: str) -> None:
    """Rate limit: 5 attempts per 60 seconds per IP+username."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"login:{ip}:{username.upper()}", max_attempts=5, window_seconds=60)


def rate_limit_recover_ip(request: Request) -> None:
    """Rate limit: 3 attempts per 15 minutes per IP (slow recovery enumeration)."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"recover:{ip}", max_attempts=3, window_seconds=900)


def rate_limit_recover_confirm_ip(request: Request) -> None:
    """Rate limit: 3 confirm attempts per 15 minutes per IP (slow code brute-force)."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"recover_confirm:{ip}", max_attempts=3, window_seconds=900)


def rate_limit_analyze(request: Request, user_key: str) -> None:
    """Rate limit: 10 analysis requests per 60 seconds per IP+user.

    Mantido em memória de propósito: janela curta de anti-abuso — barato e
    per-processo, não precisa sobreviver a restart/workers (o teto DIÁRIO,
    já, é durável em SQLite: ver app.services.ai_usage).
    """
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"analyze:{ip}:{user_key}", max_attempts=10, window_seconds=60)


def rate_limit_simulation(request: Request, user_key: str) -> None:
    """Rate limit: 5 simulation requests per 60 seconds per IP+user."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"simulation:{ip}:{user_key}", max_attempts=5, window_seconds=60)


# Chave de rate-limit por usuário (item 11): e-mail é o identificador estável
# e único por conta; contas sem e-mail caem no campo nomeado abaixo (id
# numérico). Nunca `username` (editável pelo usuário → contorna o limite).
RATE_LIMIT_USER_KEY_FALLBACK_FIELD = "id"


def user_rate_limit_key(user: Any) -> str:
    """Chave estável por conta para rate limits (ver constante acima)."""
    return user.email or str(getattr(user, RATE_LIMIT_USER_KEY_FALLBACK_FIELD))


def rate_limit_resilience(request: Request, user_key: str) -> None:
    """Rate limit: 30 resilience requests per 60 seconds per IP+user.

    Endpoints de resiliência (injeção de falha, blast radius, circuit
    breakers, live doc) são bem mais leves que simulação completa —
    por isso 30/60s em vez de 5/60s (rate_limit_simulation). Custo saiu
    do bundle e tem limiter próprio: rate_limit_cost (R5).
    """
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"resilience:{ip}:{user_key}", max_attempts=30, window_seconds=60)


def rate_limit_cost(request: Request, user_key: str) -> None:
    """Rate limit: 60 cost requests per 60 seconds per IP+user (R5).

    Custo é barato e idempotente (tabela estática, node-only, sem estado)
    — por isso 60/60s em vez dos 30/60s de resiliência, num bucket
    separado (`cost:`): exaurir o limite de custo não trava a suite de
    resiliência e vice-versa.
    """
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"cost:{ip}:{user_key}", max_attempts=60, window_seconds=60)


def rate_limit_network(request: Request, user_key: str) -> None:
    """Rate limit: 30 network requests per 60 seconds per IP+user (R3).

    Análise de rede (SG/NACL/TGW + fluxos de deploy) é pesada — mesmo teto
    de resiliência (30/60s), em bucket próprio (`network:`): exaurir o
    limite de rede não trava resiliência/custo/threat e vice-versa.
    """
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"network:{ip}:{user_key}", max_attempts=30, window_seconds=60)


def rate_limit_threat(request: Request, user_key: str) -> None:
    """Rate limit: 60 threat requests per 60 seconds per IP+user (R2).

    Threat heurística é barata e idempotente (sem LLM, O(n)) — mesmo teto
    do custo (60/60s), em bucket próprio (`threat:`).
    """
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"threat:{ip}:{user_key}", max_attempts=60, window_seconds=60)


# ---------------------------------------------------------------------------
# Per-user daily LLM analyze budget (P1.9c / item 30)
# Os tetos são constantes nomeadas; o enforcement é DURÁVEL em SQLite
# (tabela ai_usage — ver app.services.ai_usage), porque contador em memória
# resetava no restart e quebrava com múltiplos workers.
# ---------------------------------------------------------------------------

LLM_DAILY_ANALYZE_BUDGET = 50
AUTO_ANALYZE_DAILY_BUDGET = 20
