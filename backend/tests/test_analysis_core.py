"""Wave-2 core de análise — items 22/23/24/25/26/27/28-be/32/34/35/39.

Cobre o core de análise SEM tocar arquivos de siblings
(p1_analysis.py, tests/test_ai_*): prompts unificados, blob truncável,
grounding de nós, cache vivo, contagens/uso de LLM, summary do consolidador,
stamps de origem e runtime escopado ao usuário.
"""

import re

from fastapi.testclient import TestClient

from app.agents import runner as runner_mod
from app.agents.runner import (
    AGENT_CONSOLIDATOR,
    AGENT_HEURISTIC,
    TRUNCATION_MARKER,
    _agent_user_prompt,
    _graph_blob,
    analyze_architecture,
)
from app.agents.prompts import (
    ARCHITECTURE_PROMPT,
    CODE_PROMPT,
    COHERENCE_PROMPT,
    CONSOLIDATOR_PROMPT,
    DATABASE_PROMPT,
    FIX_ACTION_RULE,
    GROUNDING_RULE,
    GRAPH_DATA_CLOSE,
    GRAPH_DATA_OPEN,
    SECURITY_PROMPT,
    STYLE_PROMPT,
    SUMMARY_RULE,
    TRADEOFFS_PROMPT,
    UNTRUSTED_DATA_RULE,
)
from app.database import SessionLocal
from app.models.ai_usage import AiUsage
from app.models.user import User
from app.services.ai_usage import current_utc_day
from app.services.omniroute import CompleteResult, Usage


def _nodes() -> list[dict]:
    return [
        {"id": "n1", "type": "arch", "position": {"x": 0, "y": 0}, "data": {"kind": "backend", "label": "API", "tech": "FastAPI"}},
        {"id": "n2", "type": "arch", "position": {"x": 200, "y": 0}, "data": {"kind": "database", "label": "Postgres", "tech": "PostgreSQL"}},
    ]


def _edges() -> list[dict]:
    return [{"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "sync"}}]


def _agent_name_from_system(system: str) -> str:
    """Chave do agente embutida no prompt ("Agente: <name>.")."""
    match = re.search(r"Agente: (\w+)", system)
    return match.group(1) if match else "consolidator"


def _ok_payload(name: str = "architecture") -> dict:
    """Payload mínimo válido de AgentReport com finding ancorado no grafo."""
    return {
        "agent": name,
        "score": 7,
        "findings": [
            {"node_id": "n1", "severity": "warning", "title": f"Finding {name}", "detail": "d", "evidence_node_ids": ["n1"]},
        ],
        "strengths": [f"forca {name}"],
        "risks": [f"risco {name}"],
        "suggestions": [f"sugestao {name}"],
    }


def _all_ok_fake(monkeypatch, usage: Usage | None = None, consolidator_summary: str | None = None) -> list:
    """Mock de complete_json que responde ok p/ todos (título único por agente
    para a dedup por título não esconder os stamps)."""
    calls: list[dict] = []

    async def fake(system: str, user_prompt: str, runtime=None) -> CompleteResult:
        name = _agent_name_from_system(system)
        data = _ok_payload(name)
        if system is CONSOLIDATOR_PROMPT and consolidator_summary is not None:
            data["summary"] = consolidator_summary
        calls.append({"name": name, "runtime": runtime})
        return CompleteResult(data=data, usage=usage, attempts=1, ok=True)

    monkeypatch.setattr(runner_mod, "complete_json", fake)
    return calls


class TestPrompts:
    """Items 22/25/32/34/35 — forma dos prompts (assert nos strings montados)."""

    def test_agent_prompts_carry_guard_grounding_and_fix_rules(self):
        agent_prompts = {
            "architecture": ARCHITECTURE_PROMPT,
            "database": DATABASE_PROMPT,
            "code": CODE_PROMPT,
            "security": SECURITY_PROMPT,
            "style": STYLE_PROMPT,
            "coherence": COHERENCE_PROMPT,
            "tradeoffs": TRADEOFFS_PROMPT,
        }
        for key, prompt in agent_prompts.items():
            assert GROUNDING_RULE in prompt, key  # item 25
            assert UNTRUSTED_DATA_RULE in prompt, key  # item 32
            assert FIX_ACTION_RULE in prompt, key  # item 35
            assert '"evidence_node_ids"' in prompt, key
            assert '"summary"' in prompt, key  # item 34: schema unico c/ summary

    def test_item22_removed_per_agent_json_examples(self):
        # Exemplos JSON conflitantes (arch_style/an_score/trade_offs) sumiram;
        # o estilo segue vindo de classify_architecture_style (heurística).
        assert "an_score" not in COHERENCE_PROMPT
        assert "justification" not in STYLE_PROMPT
        assert '"trade_offs"' not in TRADEOFFS_PROMPT
        assert "arch_style" not in STYLE_PROMPT

    def test_consolidator_prompt_requires_summary(self):
        assert SUMMARY_RULE in CONSOLIDATOR_PROMPT
        assert UNTRUSTED_DATA_RULE in CONSOLIDATOR_PROMPT
        assert '"summary"' in CONSOLIDATOR_PROMPT

    def test_graph_user_prompt_wraps_blob_between_delimiters(self):
        p = _agent_user_prompt('{"nodes": []}')
        assert p.index(GRAPH_DATA_OPEN) < p.index('{"nodes": []}') < p.index(GRAPH_DATA_CLOSE)


class TestGraphBlob:
    """Item 23 — metadados de aresta + extras de nó + truncagem progressiva."""

    def test_includes_edge_metadata_and_node_extras(self):
        nodes = [
            {
                "id": "n1",
                "data": {
                    "kind": "backend",
                    "label": "API",
                    "piiSensitivity": "high",
                    "notes": "nota do backend",
                    "catalogId": "be-fastapi",
                    "capacityContract": {"max_rps": 800},
                },
            }
        ]
        edges = [
            {"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "async", "label": "fluxo", "isCriticalPath": True}}
        ]
        blob = _graph_blob(nodes, edges)
        assert "flowKind" in blob
        assert '"isCriticalPath": true' in blob
        assert "piiSensitivity" in blob
        assert "nota do backend" in blob
        assert "be-fastapi" in blob
        assert "max_rps" in blob
        assert "truncado" not in blob

    def test_truncation_drops_edge_meta_then_longest_notes_with_marker(self, monkeypatch):
        monkeypatch.setattr(runner_mod, "MAX_GRAPH_BLOB_CHARS", 3000)
        nodes = [
            {"id": "n1", "data": {"kind": "backend", "label": "API", "notes": "A" * 5000}},
            {"id": "n2", "data": {"kind": "database", "label": "DB", "notes": "B" * 1000}},
        ]
        edges = [
            {"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "async", "label": "fluxo", "isCriticalPath": True}}
        ]
        blob = _graph_blob(nodes, edges)
        assert len(blob) <= 3000
        assert TRUNCATION_MARKER in blob  # o LLM sabe que a entrada está incompleta
        assert "flowKind" not in blob  # passo 1: metadados de aresta cortados primeiro
        assert "A" * 4 not in blob  # passo 2: nota mais longa cortada
        assert "B" * 4 in blob  # nota mais curta preservada

    def test_hard_cap_removes_all_notes_when_necessary(self, monkeypatch):
        monkeypatch.setattr(runner_mod, "MAX_GRAPH_BLOB_CHARS", 800)
        nodes = [
            {"id": "n1", "data": {"kind": "backend", "label": "API", "notes": "A" * 5000}},
            {"id": "n2", "data": {"kind": "database", "label": "DB", "notes": "B" * 1000}},
        ]
        edges = [
            {"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "async", "label": "fluxo", "isCriticalPath": True}}
        ]
        blob = _graph_blob(nodes, edges)
        assert len(blob) <= 800
        assert TRUNCATION_MARKER in blob
        assert "A" * 4 not in blob
        assert "B" * 4 not in blob
        # Estrutura base (ids/labels) sobrevive mesmo no último recurso.
        assert '"n1"' in blob and '"n2"' in blob


class TestAgentCounting:
    """Item 27 — agents_done/agents_failed via CompleteResult.ok + usage agregada."""

    async def test_all_failures(self, monkeypatch):
        async def fake(system, user_prompt, runtime=None):
            return CompleteResult(data=None, usage=None, attempts=1, ok=False)

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        result = await analyze_architecture(_nodes(), _edges())
        # Consolidador não roda sem nenhum relatório: 7 agentes, todos falharam.
        assert result.agents_done == 0
        assert result.agents_failed == 7
        assert result.usage.total_calls == 7
        assert result.usage.prompt_tokens == 0
        assert result.usage.completion_tokens == 0

    async def test_partial_success_includes_consolidator(self, monkeypatch):
        ok_agents = {"architecture", "database"}

        async def fake(system, user_prompt, runtime=None):
            name = _agent_name_from_system(system)
            if name in ok_agents:
                return CompleteResult(
                    data=_ok_payload(name),
                    usage=Usage(prompt_tokens=10, completion_tokens=5),
                    attempts=1,
                    ok=True,
                )
            return CompleteResult(data=None, usage=None, attempts=1, ok=False)

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        result = await analyze_architecture(_nodes(), _edges())
        assert result.agents_done == 2  # só 2 agentes ok
        assert result.agents_failed == 6  # 5 agentes + 1 consolidador (rodou, falhou)
        assert result.usage.total_calls == 8  # 8 chamadas HTTP efetivadas
        assert result.usage.prompt_tokens == 20
        assert result.usage.completion_tokens == 10


class TestNodeGrounding:
    """Item 24 — ids alucinados caem; item 39 — origem estampada em todo finding."""

    async def test_unknown_node_ids_dropped(self, monkeypatch):
        async def fake(system, user_prompt, runtime=None):
            return CompleteResult(
                data={
                    "agent": "security",
                    "score": 5,
                    "findings": [
                        {
                            "node_id": "ghost-node",
                            "severity": "critical",
                            "title": "Ghost critical",
                            "detail": "d",
                            "evidence_node_ids": ["ghost-node", "n1"],
                        },
                        {
                            "node_id": "n1",
                            "severity": "warning",
                            "title": "Real warning",
                            "detail": "d",
                            "evidence_node_ids": ["n1", "ghost-node"],
                        },
                    ],
                    "strengths": [],
                    "risks": [],
                    "suggestions": [],
                },
                usage=None,
                attempts=1,
                ok=True,
            )

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        result = await analyze_architecture(_nodes(), _edges())
        assert all(f.node_id != "ghost-node" for f in result.findings)
        assert "ghost-node" not in result.node_scores
        if result.score_breakdown is not None:
            assert "ghost-node" not in result.score_breakdown.critical_node_ids
        real = [f for f in result.findings if f.title == "Real warning"]
        assert real
        assert real[0].evidence_node_ids == ["n1"]  # evidência inválida limpa
        assert real[0].agent == "security"

    async def test_agent_stamps_on_every_finding(self, monkeypatch):
        _all_ok_fake(monkeypatch)
        result = await analyze_architecture(_nodes(), _edges())
        agents = {f.agent for f in result.findings}
        assert AGENT_HEURISTIC in agents
        assert "architecture" in agents  # chave do agente
        assert AGENT_CONSOLIDATOR in agents
        assert None not in agents  # nenhum finding sem origem


class TestSummary:
    """Item 34 — summary vem do campo dedicado do consolidador."""

    async def test_summary_from_consolidator_field(self, monkeypatch):
        summary_text = "Arquitetura coesa, 7/10: boa segregação mas banco é ponto único de falha."
        _all_ok_fake(monkeypatch, consolidator_summary=summary_text)
        result = await analyze_architecture(_nodes(), _edges())
        assert result.summary == summary_text  # verbatim, sem reformat hack

    async def test_summary_fallback_to_first_strength(self, monkeypatch):
        strength = "Forca do consolidador sem prefixo"

        async def fake(system, user_prompt, runtime=None):
            if system is CONSOLIDATOR_PROMPT:
                return CompleteResult(
                    data={"agent": "consolidator", "score": 7, "strengths": [strength]},
                    usage=None,
                    attempts=1,
                    ok=True,
                )
            return CompleteResult(data=_ok_payload(_agent_name_from_system(system)), usage=None, attempts=1, ok=True)

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        result = await analyze_architecture(_nodes(), _edges())
        assert result.summary == strength  # sem wrap "Arquitetura: X/10 — ..."

    async def test_no_consolidator_keeps_heuristic_summary(self, monkeypatch):
        async def fake(system, user_prompt, runtime=None):
            return CompleteResult(data=None, usage=None, attempts=1, ok=False)

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        result = await analyze_architecture(_nodes(), _edges())
        assert result.summary.startswith("Arquitetura:")  # fallback heurístico


class TestLiveCache:
    """Item 26 — cache de fingerprint no endpoint vivo (lido ANTES do orçamento)."""

    def _live_payload(self, gid: str) -> dict:
        return {"name": "live-cache", "nodes": _nodes(), "edges": _edges(), "persist_id": gid}

    def test_cache_hit_returns_cached_true_without_llm(self, client: TestClient, monkeypatch):
        calls = {"n": 0}

        async def fake(system, user_prompt, runtime=None):
            calls["n"] += 1
            return CompleteResult(data=_ok_payload(), usage=None, attempts=1, ok=True)

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        gid = client.post("/api/v1/graphs", json={"name": "live-cache", "nodes": _nodes(), "edges": _edges()}).json()["id"]

        first = client.post("/api/v1/analyze", json=self._live_payload(gid))
        assert first.status_code == 200
        assert first.json()["cached"] is False
        after_first = calls["n"]
        assert after_first > 0

        second = client.post("/api/v1/analyze", json=self._live_payload(gid))
        assert second.status_code == 200
        assert second.json()["cached"] is True
        assert calls["n"] == after_first  # cache hit: LLM não é chamado

        usage = client.get("/api/v1/settings/ai/usage").json()
        assert usage["analyze_used"] == 1  # orçamento durável consumido UMA vez

    def test_cache_hit_still_requires_consent(self, client: TestClient, no_omniroute):
        gid = client.post("/api/v1/graphs", json={"name": "consent-cache", "nodes": _nodes(), "edges": _edges()}).json()["id"]
        first = client.post("/api/v1/analyze", json=self._live_payload(gid))
        assert first.status_code == 200  # provider local (omniroute) não exige consentimento
        assert first.json()["cached"] is False

        put = client.put(
            "/api/v1/settings/ai",
            json={
                "provider": "openai",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-consent-cache-test",
                "model": "gpt-4o-mini",
                "enabled": True,
                "llm_data_consent": False,
            },
        )
        assert put.status_code == 200
        # Mesmo com cache válido, o gate de consentimento (topo do endpoint) barra.
        again = client.post("/api/v1/analyze", json=self._live_payload(gid))
        assert again.status_code == 403

    def test_saved_cache_hit_is_flagged_cached_true(self, client: TestClient, no_omniroute):
        gid = client.post("/api/v1/graphs", json={"name": "saved-cache", "nodes": _nodes(), "edges": _edges()}).json()["id"]
        assert client.post(f"/api/v1/graphs/{gid}/analyze").status_code == 200
        assert client.post(f"/api/v1/graphs/{gid}/analyze").json()["cached"] is True


class TestTokensAndUserRuntime:
    """Item 28-be/27 — runtime do usuário chega ao LLM; tokens REAIS persistidos."""

    def test_real_tokens_recorded_to_ai_usage(self, client: TestClient, monkeypatch):
        async def fake(system, user_prompt, runtime=None):
            return CompleteResult(
                data=_ok_payload(_agent_name_from_system(system)),
                usage=Usage(prompt_tokens=300, completion_tokens=120),
                attempts=1,
                ok=True,
            )

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        gid = client.post("/api/v1/graphs", json={"name": "tokens", "nodes": _nodes(), "edges": _edges()}).json()["id"]
        resp = client.post("/api/v1/analyze", json={"name": "tokens", "nodes": _nodes(), "edges": _edges(), "persist_id": gid})
        assert resp.status_code == 200
        body = resp.json()
        # 7 agentes + 1 consolidador, todos com usage 300/120.
        assert body["usage"]["prompt_tokens"] == 8 * 300
        assert body["usage"]["completion_tokens"] == 8 * 120
        assert body["usage"]["total_calls"] == 8

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == "SENIOR").one()
            row = db.get(AiUsage, (user.id, current_utc_day()))
            assert row is not None
            assert row.tokens_in == 8 * 300
            assert row.tokens_out == 8 * 120
        finally:
            db.close()

    def test_user_scoped_runtime_reaches_llm(self, client: TestClient, monkeypatch):
        calls = _all_ok_fake(monkeypatch)
        put = client.put(
            "/api/v1/settings/ai",
            json={
                "provider": "openai",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-user-scoped-999",
                "model": "gpt-user-test",
                "enabled": True,
                "llm_data_consent": True,
            },
        )
        assert put.status_code == 200
        resp = client.post("/api/v1/analyze", json={"name": "scoped", "nodes": _nodes(), "edges": _edges()})
        assert resp.status_code == 200
        assert calls, "complete_json não foi chamado"
        for call in calls:
            assert call["runtime"] is not None, "runtime do usuário deveria chegar ao LLM"
            assert call["runtime"].provider == "openai"
            assert call["runtime"].model == "gpt-user-test"

    async def test_one_arg_behavior_without_user(self, monkeypatch):
        # db/user ausentes (testes/caminho legado) → runtime None, fallback de env
        # continua dentro do complete_json (behavior de 1 argumento preservado).
        seen = []

        async def fake(system, user_prompt, runtime=None):
            seen.append(runtime)
            return CompleteResult(data=_ok_payload(), usage=None, attempts=1, ok=True)

        monkeypatch.setattr(runner_mod, "complete_json", fake)
        await analyze_architecture(_nodes(), _edges())
        assert seen and all(runtime is None for runtime in seen)
