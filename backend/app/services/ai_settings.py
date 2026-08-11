from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.models.settings import AiSettings


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
        api_key=env_settings.omniroute_api_key,
        model=env_settings.omniroute_model,
        enabled="true",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def to_runtime(row: AiSettings) -> RuntimeAiConfig:
    return RuntimeAiConfig(
        provider=row.provider,
        base_url=row.base_url or env_settings.omniroute_base_url,
        api_key=row.api_key or env_settings.omniroute_api_key,
        model=row.model or env_settings.omniroute_model,
        enabled=row.enabled == "true",
    )


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
