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
    updated_at: datetime | None = None


class AiSettingsUpdate(BaseModel):
    provider: AiProvider = "omniroute"
    base_url: str = Field(min_length=1, max_length=500)
    api_key: str | None = Field(default=None, max_length=2000)
    model: str = Field(min_length=1, max_length=120)
    enabled: bool = True


class AiSettingsTestResult(BaseModel):
    ok: bool
    detail: str
    latency_ms: int | None = None
