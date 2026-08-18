"""Simple in-memory rate limiter for login/recover endpoints."""

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request

# Store: {key: [(timestamp, ...), ...]}
_buckets: dict[str, list[float]] = defaultdict(list)
_lock = threading.Lock()


def _rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Raise 429 if max_attempts exceeded within window_seconds."""
    now = time.time()
    cutoff = now - window_seconds
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


def rate_limit_recover(request: Request, username: str) -> None:
    """Rate limit: 3 attempts per 300 seconds per IP+username."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"recover:{ip}:{username.upper()}", max_attempts=3, window_seconds=300)
