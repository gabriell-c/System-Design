from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.services.ai_settings import RuntimeAiConfig, load_runtime

logger = logging.getLogger(__name__)


class OmniRouteError(Exception):
    pass


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
) -> dict[str, Any] | None:
    cfg = runtime or resolve_runtime()
    if not cfg.enabled:
        logger.info("ai_disabled_skip")
        return None
    if not cfg.api_key:
        logger.warning("ai_missing_api_key")
        return None

    if cfg.provider == "anthropic":
        return await _complete_anthropic(cfg, system_prompt, user_prompt)
    return await _complete_openai_compatible(cfg, system_prompt, user_prompt)


async def _complete_openai_compatible(
    cfg: RuntimeAiConfig,
    system_prompt: str,
    user_prompt: str,
) -> dict[str, Any] | None:
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg.model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.omniroute_timeout_s) as client:
            response = await client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            logger.warning("ai_http_error provider=%s status=%s body=%s", cfg.provider, response.status_code, response.text[:300])
            return None
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return None
        return parsed
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        logger.warning("ai_unavailable provider=%s err=%s", cfg.provider, type(exc).__name__)
        return None


async def _complete_anthropic(
    cfg: RuntimeAiConfig,
    system_prompt: str,
    user_prompt: str,
) -> dict[str, Any] | None:
    url = cfg.base_url.rstrip("/") + "/messages"
    headers = {
        "x-api-key": cfg.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg.model,
        "max_tokens": 4096,
        "system": system_prompt + "\nResponda APENAS com JSON válido.",
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.omniroute_timeout_s) as client:
            response = await client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            logger.warning("anthropic_http_error status=%s body=%s", response.status_code, response.text[:300])
            return None
        data = response.json()
        parts = data.get("content") or []
        content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        # strip markdown fences if present
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.removeprefix("json")
            cleaned = cleaned.strip()
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            return None
        return parsed
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        logger.warning("anthropic_unavailable err=%s", type(exc).__name__)
        return None
