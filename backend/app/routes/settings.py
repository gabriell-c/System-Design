from __future__ import annotations

import time

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import AiSettings
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.settings import AiSettingsOut, AiSettingsTestResult, AiSettingsUpdate
from app.services.ai_settings import get_or_create_settings, mask_key, to_runtime

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


def _out(row: AiSettings) -> AiSettingsOut:
    return AiSettingsOut(
        provider=row.provider,  # type: ignore[arg-type]
        base_url=row.base_url,
        api_key_set=bool(row.api_key and row.api_key.strip()),
        api_key_masked=mask_key(row.api_key or ""),
        model=row.model,
        enabled=row.enabled == "true",
        updated_at=row.updated_at,
    )


@router.get("/ai", response_model=AiSettingsOut)
def get_ai_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AiSettingsOut:
    return _out(get_or_create_settings(db))


@router.put("/ai", response_model=AiSettingsOut)
def put_ai_settings(payload: AiSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AiSettingsOut:
    row = get_or_create_settings(db)
    row.provider = payload.provider
    row.base_url = payload.base_url.rstrip("/")
    row.model = payload.model
    row.enabled = "true" if payload.enabled else "false"
    if payload.api_key is not None and payload.api_key.strip():
        row.api_key = payload.api_key.strip()
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post("/ai/test", response_model=AiSettingsTestResult)
async def test_ai_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AiSettingsTestResult:
    runtime = to_runtime(get_or_create_settings(db))
    if not runtime.enabled:
        return AiSettingsTestResult(ok=False, detail="IA desabilitada nas configurações.")
    if not runtime.api_key:
        return AiSettingsTestResult(ok=False, detail="API key não configurada.")

    url = runtime.base_url.rstrip("/") + "/models"
    headers = {"Authorization": f"Bearer {runtime.api_key}"}
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, headers=headers)
        latency = int((time.perf_counter() - started) * 1000)
        if response.status_code >= 400:
            chat_url = runtime.base_url.rstrip("/") + "/chat/completions"
            payload = {
                "model": runtime.model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 8,
            }
            async with httpx.AsyncClient(timeout=20.0) as client:
                chat = await client.post(
                    chat_url,
                    headers={**headers, "Content-Type": "application/json"},
                    json=payload,
                )
            latency = int((time.perf_counter() - started) * 1000)
            if chat.status_code >= 400:
                return AiSettingsTestResult(
                    ok=False,
                    detail=f"Falha HTTP {chat.status_code}: {chat.text[:180]}",
                    latency_ms=latency,
                )
            return AiSettingsTestResult(ok=True, detail="Conexão OK (chat/completions).", latency_ms=latency)
        return AiSettingsTestResult(ok=True, detail="Conexão OK (/models).", latency_ms=latency)
    except httpx.HTTPError as exc:
        return AiSettingsTestResult(ok=False, detail=f"Rede: {type(exc).__name__}")
