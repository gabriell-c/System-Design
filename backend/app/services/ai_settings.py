from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.models.settings import AiSettings
from app.services.secret_crypto import decrypt_secret, encrypt_secret


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


def get_or_create_settings(db: Session) -> AiSettings:
    row = db.get(AiSettings, "default")
    if row:
        return row
    row = AiSettings(
        id="default",
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


def load_runtime(db: Session) -> RuntimeAiConfig:
    return to_runtime(get_or_create_settings(db))


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
