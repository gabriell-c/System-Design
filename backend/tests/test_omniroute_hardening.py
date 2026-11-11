"""Hardening da pipeline LLM: retry/backoff, strip de fences, usage, clamp e dedup.

Cobre os itens 14/15 (omniroute), 16 (clamp de score), 18 (dedup por título
normalizado) e a passagem de usage via CompleteResult.
"""

from __future__ import annotations

import json
from typing import ClassVar

import httpx
import pytest

from app.agents.runner import _dedupe_findings
from app.schemas.analysis import AgentReport, Finding
from app.services import omniroute
from app.services.ai_settings import RuntimeAiConfig
from app.services.omniroute import Usage, complete_json, strip_json_fences


def _cfg(provider: str = "openai") -> RuntimeAiConfig:
    return RuntimeAiConfig(
        provider=provider,
        base_url="http://fake.local/v1",
        api_key="test-key",
        model="test-model",
        enabled=True,
    )


class _FakeResponse:
    def __init__(self, status_code: int, body: dict | None):
        self.status_code = status_code
        self.body = body
        self.text = json.dumps(body) if body is not None else ""

    def json(self):
        if self.body is None:
            raise json.JSONDecodeError("empty body", "", 0)
        return self.body


def _patch_httpx(monkeypatch: pytest.MonkeyPatch, responses: list) -> list:
    """Troca httpx.AsyncClient por um fake determinístico. Retorna a lista de payloads enviados."""

    class _FakeAsyncClient:
        calls: ClassVar[list] = []

        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        async def post(self, url, headers=None, json=None):
            _FakeAsyncClient.calls.append(json)
            return responses.pop(0)

    monkeypatch.setattr(omniroute.httpx, "AsyncClient", _FakeAsyncClient)
    return _FakeAsyncClient.calls


# ---------------------------------------------------------------- fence strip

def test_strip_fence_lowercase():
    assert strip_json_fences('```json\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_fence_uppercase():
    assert strip_json_fences('```JSON\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_fence_tag_with_space():
    assert strip_json_fences('``` Json\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_fence_bare():
    assert strip_json_fences('```\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_fence_single_line_with_trailing_fence():
    assert strip_json_fences('```json {"a": 1} ```') == '{"a": 1}'


def test_strip_fence_plain_json_passthrough():
    assert strip_json_fences('  {"a": 1}  ') == '{"a": 1}'


# ---------------------------------------------------------------- score clamp

def test_agent_score_clamped_to_max():
    report = AgentReport.model_validate({"agent": "architecture", "score": 50})
    assert report.score == 10.0


def test_agent_score_clamped_to_min():
    report = AgentReport.model_validate({"agent": "architecture", "score": -3})
    assert report.score == 0.0


def test_agent_score_in_bounds_unchanged():
    report = AgentReport.model_validate({"agent": "architecture", "score": 7.4})
    assert report.score == 7.4


# ---------------------------------------------------------------- findings dedup

def test_dedup_findings_by_normalized_title_keeps_first():
    findings = [
        Finding(severity="info", title="  Cache Missing  ", detail="primeiro"),
        Finding(severity="warning", title="cache missing", detail="rephrase exato"),
        Finding(severity="critical", title="Cache Missing", detail="rephrase maiúsculo"),
        Finding(severity="info", title="Unique Title", detail="outro"),
    ]
    result = _dedupe_findings(findings)
    assert [f.title for f in result] == ["  Cache Missing  ", "Unique Title"]
    assert [f.detail for f in result] == ["primeiro", "outro"]


# ---------------------------------------------------------------- retry/backoff

def _openai_body(content: str) -> dict:
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {"prompt_tokens": 11, "completion_tokens": 7},
    }


async def test_retry_succeeds_on_second_attempt(monkeypatch):
    responses = [
        _FakeResponse(500, None),
        _FakeResponse(200, _openai_body(json.dumps({"agent": "architecture", "score": 8}))),
    ]
    calls = _patch_httpx(monkeypatch, responses)
    result = await complete_json("sys", "user", runtime=_cfg())
    assert result.ok
    assert result.data == {"agent": "architecture", "score": 8}
    assert result.attempts == 2
    assert len(calls) == 2


async def test_no_retry_on_4xx(monkeypatch):
    responses = [
        _FakeResponse(400, {"error": "invalid key"}),
        _FakeResponse(200, _openai_body(json.dumps({"agent": "a", "score": 1}))),
    ]
    calls = _patch_httpx(monkeypatch, responses)
    result = await complete_json("sys", "user", runtime=_cfg())
    assert not result.ok
    assert result.data is None
    assert result.attempts == 1
    assert len(calls) == 1


async def test_retry_exhausted_returns_failure_with_attempt_count(monkeypatch, caplog):
    responses = [
        _FakeResponse(500, None),
        _FakeResponse(503, None),
    ]
    _patch_httpx(monkeypatch, responses)
    with caplog.at_level("WARNING"):
        result = await complete_json("sys", "user", runtime=_cfg())
    assert not result.ok
    assert result.data is None
    assert result.attempts == 2
    assert any("attempts=2" in record.message for record in caplog.records)


async def test_retry_on_transport_error_then_success(monkeypatch):
    class _TransportFlakyClient:
        calls = 0

        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        async def post(self, url, headers=None, **_kwargs):
            type(self).calls += 1
            if type(self).calls == 1:
                raise httpx.ConnectError("connection refused")
            return _FakeResponse(200, _openai_body(json.dumps({"agent": "a", "score": 5})))

    monkeypatch.setattr(omniroute.httpx, "AsyncClient", _TransportFlakyClient)
    result = await complete_json("sys", "user", runtime=_cfg())
    assert result.ok
    assert result.attempts == 2


# ---------------------------------------------------------------- usage passthrough

async def test_openai_usage_captured_and_max_tokens_sent(monkeypatch):
    responses = [_FakeResponse(200, _openai_body(json.dumps({"agent": "a", "score": 9})))]
    calls = _patch_httpx(monkeypatch, responses)
    result = await complete_json("sys", "user", runtime=_cfg())
    assert result.ok
    assert result.usage == Usage(prompt_tokens=11, completion_tokens=7)
    assert calls[0]["max_tokens"] == 4096


async def test_anthropic_usage_captured_and_json_fence_stripped(monkeypatch):
    body = {
        "content": [
            {"type": "text", "text": '```JSON\n{"agent": "architecture", "score": 5}\n```'},
        ],
        "usage": {"input_tokens": 2, "output_tokens": 4},
    }
    responses = [_FakeResponse(200, body)]
    _patch_httpx(monkeypatch, responses)
    result = await complete_json("sys", "user", runtime=_cfg(provider="anthropic"))
    assert result.ok
    assert result.data == {"agent": "architecture", "score": 5}
    assert result.usage == Usage(prompt_tokens=2, completion_tokens=4)


async def test_usage_none_when_provider_omits_it(monkeypatch):
    payload = {"choices": [{"message": {"content": json.dumps({"agent": "a", "score": 1})}}]}
    responses = [_FakeResponse(200, payload)]
    _patch_httpx(monkeypatch, responses)
    result = await complete_json("sys", "user", runtime=_cfg())
    assert result.ok
    assert result.usage is None
