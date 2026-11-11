from __future__ import annotations

import logging
import time

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import AiSettings
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.settings import (
    AiSettingsOut,
    AiSettingsTestRequest,
    AiSettingsTestResult,
    AiSettingsUpdate,
    AiUsageOut,
)
from app.services.ai_settings import (
    RuntimeAiConfig,
    get_user_settings,
    mask_key,
    plaintext_api_key,
    to_runtime,
    update_user_settings,
)
from app.services.ai_usage import ai_usage_summary

logger = logging.getLogger("archia.settings")

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


def _out(row: AiSettings) -> AiSettingsOut:
    plain = plaintext_api_key(row)
    return AiSettingsOut(
        provider=row.provider,  # type: ignore[arg-type]
        base_url=row.base_url,
        api_key_set=bool(plain and plain.strip()),
        api_key_masked=mask_key(plain),
        model=row.model,
        enabled=row.enabled == "true",
        llm_data_consent=row.llm_data_consent == "true",
        updated_at=row.updated_at,
    )


@router.get("/ai", response_model=AiSettingsOut)
def get_ai_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AiSettingsOut:
    # Item 29 — configurações por usuário (linha criada na primeira leitura).
    return _out(get_user_settings(db, current_user))


@router.put("/ai", response_model=AiSettingsOut)
def put_ai_settings(
    payload: AiSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiSettingsOut:
    # Item 29 — as configurações (e a chave) agora são do próprio usuário,
    # então qualquer usuário autenticado edita as dele.
    row = update_user_settings(db, current_user, payload)
    if payload.api_key is not None and payload.api_key.strip():
        # P1.5 — rotação registrada em log estruturado (auditoria, sem expor a chave).
        logger.info("ai_settings.api_key_rotated user=%s", current_user.username)
    return _out(row)


@router.get("/ai/usage", response_model=AiUsageOut)
def get_ai_usage(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AiUsageOut:
    """Item 41 — uso do dia (orçamento de IA) no shape exato do badge da UI."""
    return ai_usage_summary(db, current_user.id)


@router.post("/ai/test", response_model=AiSettingsTestResult)
async def test_ai_settings(
    payload: AiSettingsTestRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiSettingsTestResult:
    """Sonda o provedor configurado; com body (item 9) sonda o RASCUNHO sem salvar."""
    row = get_user_settings(db, current_user)
    if payload is None:
        return await _probe(to_runtime(row))
    draft = to_runtime(row)
    # Mescla draft sobre as configurações salvas: campos omitidos herdam o
    # valor salvo; api_key fornecida só existe em memória (nunca é persistida).
    draft = RuntimeAiConfig(
        provider=payload.provider or draft.provider,
        base_url=(payload.base_url or draft.base_url).rstrip("/"),
        api_key=(payload.api_key.strip() or draft.api_key) if payload.api_key is not None else draft.api_key,
        model=payload.model or draft.model,
        enabled=draft.enabled,
    )
    return await _probe(draft)


async def _probe(runtime: RuntimeAiConfig) -> AiSettingsTestResult:
    """Sonda a conectividade do provedor (comportamento original do test)."""
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
