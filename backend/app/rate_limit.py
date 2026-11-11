"""In-memory rate limiter for auth and expensive endpoints.

Hardening (P1.10):
- `_buckets` is bounded (~10k keys) and swept lazily + periodically, so a
  flood of unique IPs cannot exhaust memory.
- Per-user daily LLM analyze budget (P1.9c) with day-key + TTL sweep.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict

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
        _llm_daily.clear()
        _last_sweep = 0.0


def _rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Raise 429 if max_attempts exceeded within window_seconds."""
    now = time.time()
    cutoff = now - window_seconds
    _maybe_sweep()
    with _lock:
        _buckets[key] = [t for t in _buckets[key] if t > cutoff]
        if len(_buckets[key]) >= max_attempts:
            raise HTTPException(
                status_code=429,
                detail=f"Too many attempts. Try again in {window_seconds} seconds.",
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
    """Rate limit: 10 analysis requests per 60 seconds per IP+user."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"analyze:{ip}:{user_key}", max_attempts=10, window_seconds=60)


def rate_limit_simulation(request: Request, user_key: str) -> None:
    """Rate limit: 5 simulation requests per 60 seconds per IP+user."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"simulation:{ip}:{user_key}", max_attempts=5, window_seconds=60)


# ---------------------------------------------------------------------------
# Per-user daily LLM analyze budget (P1.9c)
# In-memory counter keyed by (user, UTC day) with a TTL sweep of stale days.
# ---------------------------------------------------------------------------

LLM_DAILY_ANALYZE_BUDGET = 50
_llm_daily: dict[str, int] = {}
_llm_day_key = ""


def _current_llm_day() -> str:
    """UTC calendar day — the key under which the budget counter lives."""
    return time.strftime("%Y-%m-%d", time.gmtime())


def rate_limit_llm_budget(user_id: int, limit: int | None = None) -> None:
    """Raise 429 with a retry-after style message when the daily budget is spent.

    Only called when a real LLM run will happen (cache hits are free), so the
    counter increments once per actual analyze-run.
    """
    budget = LLM_DAILY_ANALYZE_BUDGET if limit is None else limit
    day = _current_llm_day()
    global _llm_day_key
    key = f"llm:{user_id}:{day}"
    with _lock:
        # TTL sweep: drop counters from previous days (consistent lazy style).
        if day != _llm_day_key:
            _llm_day_key = day
            _llm_daily.clear()
        used = _llm_daily.get(key, 0)
        if used >= budget:
            # Hours (rounded up) until the UTC day rolls over.
            now_utc = time.gmtime()
            secs_left = 24 * 3600 - (
                now_utc.tm_hour * 3600 + now_utc.tm_min * 60 + now_utc.tm_sec
            )
            hours_left = max(1, (secs_left + 3599) // 3600)
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily LLM analyze budget ({budget}/day) exhausted for this user. "
                    f"Retry in about {hours_left}h (resets at UTC midnight)."
                ),
            )
        _llm_daily[key] = used + 1


def llm_budget_used(user_id: int) -> int:
    """Number of analyze-runs consumed today (tests / observability)."""
    with _lock:
        return _llm_daily.get(f"llm:{user_id}:{_current_llm_day()}", 0)


def reset_llm_daily_budget() -> None:
    """Clear the per-user daily LLM budget counters (tests)."""
    global _llm_day_key
    with _lock:
        _llm_daily.clear()
        _llm_day_key = ""
