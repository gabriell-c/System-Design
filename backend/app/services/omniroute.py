"""LLM JSON completion against the configured provider (OpenAI-compat or Anthropic).

Public contract — `complete_json(system_prompt, user_prompt, runtime=None)`
always returns a `CompleteResult` dataclass (never `None`):

    CompleteResult(data=..., usage=..., attempts=..., ok=...)

    data:     dict | None  parsed JSON object on success, None on failure
    usage:    Usage | None prompt/completion tokens, when the provider reports them
    attempts: int          how many HTTP attempts were made (retries included)
    ok:       bool         True only when `data` is not None

Retry policy (item 14): at most RETRY_ATTEMPTS total attempts, RETRY_BACKOFF_S
apart, retrying ONLY on 5xx responses, timeouts and transport errors. 4xx fails
immediately (no retry). On final failure `data` is None, `ok` is False and a
warning log includes the number of attempts made.

Both the OpenAI-compatible path and the Anthropic path strip markdown code
fences (```json / ```JSON / ``` Json / bare ```) case-insensitively before
parsing, tolerant of trailing fences and whitespace.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.services.ai_settings import RuntimeAiConfig, load_runtime

logger = logging.getLogger(__name__)

RETRY_ATTEMPTS = 2  # total HTTP attempts (1 retry)
RETRY_BACKOFF_S = 0.5  # backoff between attempts (s)
MAX_TOKENS = 4096  # response budget for both providers
HTTP_ERROR_MIN_STATUS = 400  # 4xx and above are errors; 4xx never retried
RETRYABLE_MIN_STATUS = 500  # 5xx and transport errors are retryable
ERROR_BODY_LOG_CHARS = 300  # error-body slice kept in log lines
FENCE_OPEN_RE = re.compile(r"^\s*```[ \t]*[A-Za-z0-9+_-]*[ \t]*\n?")
FENCE_CLOSING = "```"
JSON_CONTENT_RE = re.compile(r"^\s*(\{.*\}|\[.*\])\s*$", re.DOTALL)


@dataclass(frozen=True)
class Usage:
    prompt_tokens: int
    completion_tokens: int


@dataclass(frozen=True)
class CompleteResult:
    data: dict[str, Any] | None
    usage: Usage | None
    attempts: int
    ok: bool


def _failure(attempts: int) -> CompleteResult:
    return CompleteResult(data=None, usage=None, attempts=attempts, ok=False)


def strip_json_fences(raw: str) -> str:
    """Remove markdown code fences around JSON, case-insensitively.

    Tolerates ```json / ```JSON / ``` Json / bare ``` opening fences, an
    optional language tag, a trailing closing fence and surrounding
    whitespace. Bare JSON passes through unchanged.
    """
    cleaned = raw.strip()
    match = FENCE_OPEN_RE.match(cleaned)
    if not match:
        return cleaned
    cleaned = cleaned[match.end():]
    stripped = cleaned.rstrip()
    if stripped.endswith(FENCE_CLOSING):
        cleaned = stripped[: -len(FENCE_CLOSING)]
    return cleaned.strip()


def _usage_from(payload: dict, prompt_key: str, completion_key: str) -> Usage | None:
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    prompt_tokens = usage.get(prompt_key)
    completion_tokens = usage.get(completion_key)
    if prompt_tokens is None and completion_tokens is None:
        return None
    return Usage(
        prompt_tokens=int(prompt_tokens or 0),
        completion_tokens=int(completion_tokens or 0),
    )


async def _post_with_retry(
    provider: str,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> tuple[dict[str, Any] | None, int | None, int]:
    """POST with retry/backoff. Returns (body_json | None, status | None, attempts).

    Retries only 5xx responses and transport errors (timeouts, connect errors);
    4xx and non-JSON bodies fail immediately. On final failure a warning log
    includes how many attempts were made.
    """
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        status: int | None = None
        transport_error: httpx.HTTPError | None = None
        try:
            async with httpx.AsyncClient(timeout=settings.omniroute_timeout_s) as client:
                response = await client.post(url, headers=headers, json=payload)
            status = response.status_code
            if status < HTTP_ERROR_MIN_STATUS:
                try:
                    return response.json(), status, attempt
                except json.JSONDecodeError:
                    logger.warning(
                        "ai_non_json_body provider=%s status=%d attempts=%d",
                        provider,
                        status,
                        attempt,
                    )
                    return None, status, attempt
            if status < RETRYABLE_MIN_STATUS:  # 4xx — never retried
                logger.warning(
                    "ai_http_error provider=%s status=%d attempts=%d body=%s",
                    provider,
                    status,
                    attempt,
                    response.text[:ERROR_BODY_LOG_CHARS],
                )
                return None, status, attempt
        except httpx.HTTPError as exc:
            transport_error = exc

        if attempt < RETRY_ATTEMPTS:
            await asyncio.sleep(RETRY_BACKOFF_S)
            continue
        logger.warning(
            "ai_failed provider=%s status=%s err=%s attempts=%d",
            provider,
            status,
            type(transport_error).__name__ if transport_error else None,
            attempt,
        )
        return None, status, attempt
    raise AssertionError("unreachable: retry loop always returns")


def _parse_content(content: Any, attempts: int, provider: str) -> dict[str, Any] | None:
    """Parse (possibly fenced) JSON content; non-dict/undecodable → None."""
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(content, str):
        logger.warning("ai_bad_content_type provider=%s type=%s attempts=%d", provider, type(content).__name__, attempts)
        return None
    text = strip_json_fences(content)
    match = JSON_CONTENT_RE.match(text)
    if match:
        text = match.group(1)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        logger.warning("ai_bad_json_shape provider=%s type=%s attempts=%d", provider, type(parsed).__name__, attempts)
        return None
    return parsed


def _env_fallback() -> RuntimeAiConfig:
    return RuntimeAiConfig(
        provider="omniroute",
        base_url=settings.omniroute_base_url,
        api_key=settings.omniroute_api_key,
        model=settings.omniroute_model,
        enabled=True,
    )


def resolve_runtime(db: Session | None = None) -> RuntimeAiConfig:
    owns = False
    session = db
    if session is None:
        session = SessionLocal()
        owns = True
    try:
        return load_runtime(session)
    except Exception:  # noqa: BLE001 — fallback to env vars when DB settings fail
        logger.warning("ai_settings_load_failed_using_env")
        return _env_fallback()
    finally:
        if owns and session is not None:
            session.close()


async def complete_json(
    system_prompt: str,
    user_prompt: str,
    runtime: RuntimeAiConfig | None = None,
) -> CompleteResult:
    """See module docstring for the CompleteResult contract and retry policy."""
    cfg = runtime or resolve_runtime()
    if not cfg.enabled:
        logger.info("ai_disabled_skip")
        return _failure(0)
    if not cfg.api_key:
        logger.warning("ai_missing_api_key")
        return _failure(0)

    if cfg.provider == "anthropic":
        return await _complete_anthropic(cfg, system_prompt, user_prompt)
    return await _complete_openai_compatible(cfg, system_prompt, user_prompt)


async def _complete_openai_compatible(
    cfg: RuntimeAiConfig,
    system_prompt: str,
    user_prompt: str,
) -> CompleteResult:
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg.model,
        "temperature": 0.2,
        "max_tokens": MAX_TOKENS,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    body, _status, attempts = await _post_with_retry(cfg.provider, url, headers, payload)
    if body is None:
        return _failure(attempts)
    try:
        content = body["choices"][0]["message"]["content"]
        usage = _usage_from(body, "prompt_tokens", "completion_tokens")
    except (KeyError, IndexError, TypeError):
        logger.warning("ai_parse_error provider=%s attempts=%d", cfg.provider, attempts)
        return _failure(attempts)
    parsed = _parse_content(content, attempts, cfg.provider)
    if parsed is None:
        return _failure(attempts)
    return CompleteResult(data=parsed, usage=usage, attempts=attempts, ok=True)


async def _complete_anthropic(
    cfg: RuntimeAiConfig,
    system_prompt: str,
    user_prompt: str,
) -> CompleteResult:
    url = cfg.base_url.rstrip("/") + "/messages"
    headers = {
        "x-api-key": cfg.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg.model,
        "max_tokens": MAX_TOKENS,
        "system": system_prompt + "\nResponda APENAS com JSON válido.",
        "messages": [{"role": "user", "content": user_prompt}],
    }
    body, _status, attempts = await _post_with_retry("anthropic", url, headers, payload)
    if body is None:
        return _failure(attempts)
    parts = body.get("content") or []
    content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    usage = _usage_from(body, "input_tokens", "output_tokens")
    parsed = _parse_content(content, attempts, "anthropic")
    if parsed is None:
        return _failure(attempts)
    return CompleteResult(data=parsed, usage=usage, attempts=attempts, ok=True)
