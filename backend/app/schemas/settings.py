from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AiProvider = Literal["omniroute", "openai", "anthropic", "custom"]


class AiSettingsOut(BaseModel):
    provider: AiProvider
    base_url: str
    api_key_set: bool
    api_key_masked: str
    model: str
    enabled: bool
    llm_data_consent: bool
    updated_at: datetime | None = None


class AiSettingsUpdate(BaseModel):
    provider: AiProvider = "omniroute"
    base_url: str = Field(min_length=1, max_length=500)
    api_key: str | None = Field(default=None, max_length=2000)
    model: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    llm_data_consent: bool = False


class AiSettingsTestRequest(BaseModel):
    """Item 9 — rascunho opcional p/ POST /settings/ai/test: sonda sem salvar.

    Todos os campos são opcionais; campos omitidos herdam as configurações
    salvas do usuário. `api_key`, quando fornecida, nunca é persistida.
    """

    provider: AiProvider | None = None
    base_url: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, min_length=1, max_length=120)
    api_key: str | None = Field(default=None, max_length=2000)


class AiSettingsTestResult(BaseModel):
    ok: bool
    detail: str
    latency_ms: int | None = None


class AiUsageOut(BaseModel):
    """Item 41 — shape exato do GET /settings/ai/usage (badge da wave 2)."""

    day: str
    analyze_used: int
    auto_used: int
    llm_calls: int
    limit: int
    auto_limit: int
