from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.models.settings import AiSettings
from app.models.user import User
from app.schemas.settings import AiSettingsUpdate
from app.services.secret_crypto import decrypt_secret, encrypt_secret

# Provedores locais (gateway OmniRoute embutido): não exigem consentimento
# de envio de dados (DLP) — os dados não saem da máquina do usuário.
LOCAL_AI_PROVIDERS: frozenset[str] = frozenset({"omniroute"})

# Item 37 — mensagem exata (a UI reage a ela) quando falta o consentimento.
LLM_CONSENT_REQUIRED_DETAIL = (
    "Ative o consentimento de envio de dados para IA externa em "
    "Configurações → Análise por IA antes de analisar"
)


@dataclass(frozen=True)
class RuntimeAiConfig:
    provider: str
    base_url: str
    api_key: str
    model: str
    enabled: bool


def mask_key(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if len(value) <= 8:
        return "••••"
    return f"{value[:4]}…{value[-4:]}"


def get_user_settings(db: Session, user: User) -> AiSettings:
    """Linha de IA do usuário (id = str(user.id)); criada na primeira leitura.

    Item 29 — uma linha por usuário: nunca há fallback para uma linha
    global compartilhada.
    """
    row_id = str(user.id)
    row = db.get(AiSettings, row_id)
    if row:
        return row
    row = AiSettings(
        id=row_id,
        provider="omniroute",
        base_url=env_settings.omniroute_base_url,
        api_key=encrypt_secret(env_settings.omniroute_api_key),  # P1.5 — cifra em repouso
        model=env_settings.omniroute_model,
        enabled="true",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_user_settings(db: Session, user: User, payload: AiSettingsUpdate) -> AiSettings:
    """Aplica o payload nas configurações do usuário (api_key cifrada em repouso)."""
    row = get_user_settings(db, user)
    row.provider = payload.provider
    row.base_url = payload.base_url.rstrip("/")
    row.model = payload.model
    row.enabled = "true" if payload.enabled else "false"
    row.llm_data_consent = "true" if payload.llm_data_consent else "false"
    if payload.api_key is not None and payload.api_key.strip():
        row.api_key = encrypt_secret(payload.api_key.strip())
    db.commit()
    db.refresh(row)
    return row


def to_runtime(row: AiSettings) -> RuntimeAiConfig:
    # P1.5 — api_key é lida em claro apenas em memória (decifra o valor cifrado).
    return RuntimeAiConfig(
        provider=row.provider,
        base_url=row.base_url or env_settings.omniroute_base_url,
        api_key=decrypt_secret(row.api_key or "") or env_settings.omniroute_api_key,
        model=row.model or env_settings.omniroute_model,
        enabled=row.enabled == "true",
    )


def plaintext_api_key(row: AiSettings) -> str:
    """P1.5 — api_key decifrada para mask/uso; vazio se nunca definida."""
    try:
        return decrypt_secret(row.api_key or "")
    except ValueError:
        return ""


def load_runtime(db: Session, user: User | None = None) -> RuntimeAiConfig:
    """Runtime de IA para uma execução.

    Com `user`: configurações do próprio usuário. Sem `user` (o runner de
    agentes ainda não carrega contexto de usuário — wave 2): só ambiente,
    sem linha global compartilhada (item 29).
    """
    if user is not None:
        return to_runtime(get_user_settings(db, user))
    return RuntimeAiConfig(
        provider="omniroute",
        base_url=env_settings.omniroute_base_url,
        api_key=env_settings.omniroute_api_key,
        model=env_settings.omniroute_model,
        enabled=True,
    )


def require_llm_consent(db: Session, user: User, settings: AiSettings) -> None:
    """Item 37 — DLP: provedor externo exige consentimento explícito (senão 403)."""
    if settings.provider in LOCAL_AI_PROVIDERS:
        return
    if settings.llm_data_consent == "true":
        return
    raise HTTPException(status_code=403, detail=LLM_CONSENT_REQUIRED_DETAIL)


PROVIDER_PRESETS: dict[str, dict[str, str]] = {
    "omniroute": {
        "base_url": "http://localhost:20128/v1",
        "model": "auto/coding",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1",
        "model": "claude-3-5-sonnet-latest",
    },
    "custom": {
        "base_url": "https://api.example.com/v1",
        "model": "custom-model",
    },
}
