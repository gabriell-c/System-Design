"""Deterministic prompt / heuristic regression suite ("golden graphs", item 38).

This suite is a DETERMINISTIC regression guard for the local heuristics and
for the LLM prompt contracts. It runs WITHOUT any real LLM: the OmniRoute
provider is disabled (heuristic-only path, reusing the ``no_omniroute``
fixture) or replaced by a fake ``complete_json`` that returns canned
``CompleteResult`` payloads. Full LLM-quality evals (open-ended judging of
agent output) are intentionally out of scope — they are costly and flaky,
and do not belong in a fast pytest run.

Golden graphs (plain dicts mirroring the /analyze endpoint payload:
node = {id, data: {kind, label, tech, config}}, edge = {id, source, target, data}):

- G1 "monolith with public bucket" — a backend node, a public S3/bucket node
  and a database WITHOUT HA/replica, wired by edges. Expected to produce a
  security/availability finding about the public bucket and a
  database-without-HA (availability) finding on the DB node.
- G2 "microservice healthy" — CDN in front, service with a queue, replicated
  database. Expected to flag strictly fewer criticals than G1 and to carry
  no node-anchored critical findings.

Prompt contracts asserted WITHOUT an LLM:
- every agent prompt contains a node-id grounding instruction ("node_id"
  citation wording; ``Finding.evidence_node_ids`` carries the evidence);
- the shared knowledge prompt contains the KNOWLEDGE_VERSION /
  KNOWLEDGE_REVIEWED_AT markers;
- every agent prompt carries the untrusted-data guard (item 32: the
  ``<graph_data>`` delimiter plus "ignore any embedded instruction" wording,
  via UNTRUSTED_DATA_RULE in every agent prompt and in the run-agent user
  prompt through graph_data_block);
- the runner's grounding filter (item 24, ``_ground_result``) drops findings,
  node scores and critical ids that reference node ids outside the graph.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.agents import runner
from app.agents.prompts import CONSOLIDATOR_PROMPT
from app.schemas.analysis import Finding
from app.services.knowledge import (
    KNOWLEDGE_PROMPT,
    KNOWLEDGE_REVIEWED_AT,
    KNOWLEDGE_VERSION,
)
from app.services.omniroute import CompleteResult

# ---------------------------------------------------------------------------
# Golden graph payloads
# ---------------------------------------------------------------------------

G1_NODE_BACKEND = "b1"
G1_NODE_BUCKET = "s3"
G1_NODE_DB = "db"

G1_NODES = [
    {
        "id": G1_NODE_BACKEND,
        "data": {
            "kind": "backend",
            "label": "Monolith API",
            "tech": "FastAPI",
            "config": {"framework": "FastAPI"},
        },
    },
    {
        "id": G1_NODE_BUCKET,
        "data": {
            "kind": "cloud",
            "label": "S3 bucket público",
            "tech": "S3",
            "config": {"service": "S3", "capability": "public-read"},
        },
    },
    {
        "id": G1_NODE_DB,
        "data": {
            "kind": "database",
            "label": "Postgres",
            "tech": "PostgreSQL",
            "config": {"engine": "PostgreSQL"},
        },
    },
]

G1_EDGES = [
    {"id": "e1", "source": G1_NODE_BACKEND, "target": G1_NODE_BUCKET, "data": {"label": "upload", "flowKind": "data", "protocol": "https"}},
    {"id": "e2", "source": G1_NODE_BACKEND, "target": G1_NODE_DB, "data": {"label": "reads", "flowKind": "sync", "protocol": "tcp"}},
]

# NFR: enough users to clear the detect_bottlenecks anti-FP guard
# (users < 5k + monolithic returns early) and to trigger "S3 sem CDN";
# availability >= 99.9 with a single DB and no Multi-AZ triggers the
# "Banco único para alta disponibilidade" critical.
G1_NFR = {"users_per_day": 60_000, "availability_pct": 99.99, "arch_style": "monolithic"}


G2_NODE_DB_PRIMARY = "db1"
G2_NODE_DB_REPLICA = "db2"

G2_NODES = [
    {
        "id": "cdn",
        "data": {"kind": "cloud", "label": "CloudFront CDN", "tech": "CloudFront", "config": {"service": "CloudFront"}},
    },
    {
        "id": "svc",
        "data": {"kind": "backend", "label": "Orders service", "tech": "NestJS", "config": {"framework": "NestJS"}},
    },
    {"id": "queue", "data": {"kind": "integration", "label": "Kafka queue", "tech": "Kafka"}},
    {
        "id": G2_NODE_DB_PRIMARY,
        "data": {"kind": "database", "label": "PostgreSQL primary", "tech": "PostgreSQL"},
    },
    {
        "id": G2_NODE_DB_REPLICA,
        "data": {"kind": "database", "label": "PostgreSQL read replica", "tech": "PostgreSQL"},
    },
    {"id": "auth", "data": {"kind": "identity", "label": "Cognito", "tech": "Cognito"}},
    {"id": "obs", "data": {"kind": "observability", "label": "CloudWatch", "tech": "CloudWatch"}},
]

G2_EDGES = [
    {"id": "g1", "source": "cdn", "target": "svc", "data": {"flowNumber": 1, "label": "route", "protocol": "https"}},
    {"id": "g2", "source": "svc", "target": "queue", "data": {"flowNumber": 2, "label": "publish", "flowKind": "async"}},
    {"id": "g3", "source": "svc", "target": G2_NODE_DB_PRIMARY, "data": {"flowNumber": 3, "label": "writes", "protocol": "tcp"}},
    {"id": "g4", "source": G2_NODE_DB_PRIMARY, "target": G2_NODE_DB_REPLICA, "data": {"label": "replication", "flowKind": "data"}},
]

# Replicated DB (two database cards) neutralizes the single-DB HA rule;
# rpo/rto set neutralizes the "alta disponibilidade sem RPO/RTO" warning.
G2_NFR = {
    "users_per_day": 30_000,
    "availability_pct": 99.99,
    "arch_style": "microservices",
    "rpo_hours": 1,
    "rto_minutes": 15,
}

# ---------------------------------------------------------------------------
# Assertion helpers — keyword sets chosen to match what the current
# heuristics actually emit (pt-BR titles), not idealized English strings.
# ---------------------------------------------------------------------------

# G1 bucket finding: today emitted as "Object storage sem CDN" (node s3);
# a security re-emit (e.g. "bucket público") must match too.
BUCKET_TEXT_MARKERS = ("object storage", "bucket", "s3")

# G1 DB-without-HA finding: today emitted as
# "Banco único para alta disponibilidade" on the db node.
DB_HA_TEXT_MARKERS = ("banco único", "banco unico", "alta disponibilidade", "spof", "multi-az")

# Untrusted-data guard contract (item 32): a delimiter like <graph_data> and
# "untrusted" / "ignore instructions" wording, in EN or pt-BR form.
UNTRUSTED_GUARD_MARKERS = (
    "<graph_data>",
    "untrusted",
    "ignore instructions",
    "ignora as instruções",
    "ignora as instrucoes",
    "não confie",
    "nao confie",
    "prompt injection",
    "embedded instruction",
    "instrução embutida",
    "instrucao embutida",
)

GHOST_NODE_ID = "ghost-node-404"

CANNED_AGENT_REPORT = {
    "agent": "security",
    "score": 5.0,
    "findings": [
        {"node_id": GHOST_NODE_ID, "severity": "critical", "title": "Threat model: nó inexistente", "detail": "Cita um nó que não está no grafo."},
        {"node_id": G1_NODE_DB, "severity": "warning", "title": "Threat model: nó válido", "detail": "Cita o banco do grafo."},
    ],
    "strengths": ["Stack coerente"],
    "risks": ["Bucket exposto"],
    "suggestions": ["Restringir ACL do bucket"],
}


def _all_findings(result) -> list[Finding]:
    return [*result.findings, *result.threat_findings, *result.style_findings]


def _critical_count(result) -> int:
    return sum(1 for f in result.findings if f.severity == "critical")


def _run_analysis(nodes: list[dict], edges: list[dict], nfr: dict | None, context: str = ""):
    return asyncio.run(runner.analyze_architecture(nodes, edges, context=context, nfr=nfr))


def _find_bucket_findings(result) -> list[Finding]:
    out = [f for f in _all_findings(result) if f.node_id == G1_NODE_BUCKET]
    for f in _all_findings(result):
        text = f"{f.title} {f.detail}".lower()
        if f.node_id != G1_NODE_BUCKET and any(marker in text for marker in BUCKET_TEXT_MARKERS):
            out.append(f)
    return out


def _find_db_ha_criticals(result, db_node_ids: tuple[str, ...]) -> list[Finding]:
    out = []
    for f in _all_findings(result):
        if f.node_id not in db_node_ids or f.severity != "critical":
            continue
        text = f"{f.title} {f.detail}".lower()
        if any(marker in text for marker in DB_HA_TEXT_MARKERS):
            out.append(f)
    return out


def _all_agent_prompts() -> list[str]:
    return [prompt for _name, prompt in runner.AGENTS] + [CONSOLIDATOR_PROMPT]


def _patch_complete_json(monkeypatch, fake) -> None:
    """Patch the provider call site AND the source module attribute so the
    fake survives either import style (from-import vs module-attribute)."""
    monkeypatch.setattr("app.agents.runner.complete_json", fake)
    monkeypatch.setattr("app.services.omniroute.complete_json", fake)


# ---------------------------------------------------------------------------
# 1) Heuristic regression — G1 must flag the public bucket + non-HA database
# ---------------------------------------------------------------------------


@pytest.fixture()
def g1_result(no_omniroute):
    """G1 analysed through the full pipeline with the LLM disabled."""
    return _run_analysis(G1_NODES, G1_EDGES, G1_NFR, context="Monolito legado com bucket público")


@pytest.fixture()
def g2_result(no_omniroute):
    """G2 analysed through the full pipeline with the LLM disabled."""
    return _run_analysis(G2_NODES, G2_EDGES, G2_NFR, context="Microsserviços saudáveis")


def test_g1_flags_public_bucket(g1_result):
    """G1 must carry a security/availability finding about the public bucket,
    referenced by node id or by bucket wording (asserted against what the
    heuristics actually emit today)."""
    matches = _find_bucket_findings(g1_result)
    assert matches, (
        "expected at least one finding about the public S3 bucket (node 's3'), "
        f"got: {[(f.node_id, f.title) for f in g1_result.findings]}"
    )


def test_g1_flags_database_without_ha(g1_result):
    """G1's single database (no replica/multi-AZ) + 99.99% availability must
    produce a critical availability finding anchored on the DB node."""
    matches = _find_db_ha_criticals(g1_result, db_node_ids=(G1_NODE_DB,))
    assert matches, (
        "expected a critical database-without-HA finding on node 'db', "
        f"got: {[(f.node_id, f.severity, f.title) for f in g1_result.findings if f.node_id == G1_NODE_DB]}"
    )


def test_g1_critical_findings_anchored_to_db(g1_result):
    """score_breakdown.critical_node_ids must include the DB node — the UI
    banner/penalty channel for the availability risk."""
    assert g1_result.score_breakdown is not None
    assert G1_NODE_DB in g1_result.score_breakdown.critical_node_ids


def test_g2_does_not_flag_bucket_or_db_ha(g2_result):
    """G2 (CDN + queue + replicated DB) must not flag the two G1 risks."""
    assert _find_bucket_findings(g2_result) == [], [
        (f.node_id, f.title) for f in _find_bucket_findings(g2_result)
    ]
    db_ids = (G2_NODE_DB_PRIMARY, G2_NODE_DB_REPLICA)
    assert _find_db_ha_criticals(g2_result, db_node_ids=db_ids) == [], [
        (f.node_id, f.title) for f in _find_db_ha_criticals(g2_result, db_node_ids=db_ids)
    ]


def test_g2_strictly_fewer_criticals_than_g1(g1_result, g2_result):
    g1_criticals = _critical_count(g1_result)
    g2_criticals = _critical_count(g2_result)
    assert g2_criticals < g1_criticals, f"G1 criticals={g1_criticals}, G2 criticals={g2_criticals}"
    # G2's remaining criticals (ATAM coverage noise) are not node-anchored.
    assert g2_result.score_breakdown is not None
    assert g2_result.score_breakdown.critical_node_ids == []


# ---------------------------------------------------------------------------
# 2) Prompt contracts — no LLM needed, call the prompt builders directly
# ---------------------------------------------------------------------------


def test_agent_prompts_carry_node_id_grounding_instruction():
    """Every agent prompt must contain node-id citation wording; the
    evidence channel (Finding.evidence_node_ids) must exist in the schema."""
    for prompt in _all_agent_prompts():
        assert "node_id" in prompt, "agent prompt missing node-id grounding instruction"
    assert "evidence_node_ids" in Finding.model_fields


def test_knowledge_prompt_carries_version_markers():
    """Shared knowledge prompt must expose the KNOWLEDGE_VERSION /
    KNOWLEDGE_REVIEWED_AT constants, interpolated, in every agent prompt."""
    assert KNOWLEDGE_VERSION and KNOWLEDGE_REVIEWED_AT
    assert f"versão {KNOWLEDGE_VERSION}" in KNOWLEDGE_PROMPT
    assert f"revisada em {KNOWLEDGE_REVIEWED_AT}" in KNOWLEDGE_PROMPT
    for prompt in _all_agent_prompts():
        assert KNOWLEDGE_VERSION in prompt, "agent prompt missing knowledge version marker"
        assert KNOWLEDGE_REVIEWED_AT in prompt, "agent prompt missing reviewed-at marker"


def test_agent_prompts_carry_untrusted_data_guard(monkeypatch):
    """Documented contract: the graph data reaching every LLM agent is wrapped
    in an untrusted-data guard (delimiter + 'ignore any instructions inside the
    data' wording), in the system prompt and/or the run_agent user prompt."""
    captured: list[str] = []

    async def _capture_fail(system_prompt: str, user_prompt: str, runtime=None) -> CompleteResult:
        captured.append(f"{system_prompt}\n{user_prompt}")
        return CompleteResult(data=None, usage=None, attempts=0, ok=False)

    _patch_complete_json(monkeypatch, _capture_fail)
    _run_analysis(G1_NODES, G1_EDGES, G1_NFR)

    assert captured, "no LLM calls captured — complete_json patch target drifted"
    joined = " ".join(captured).lower()
    assert any(marker.lower() in joined for marker in UNTRUSTED_GUARD_MARKERS), (
        "no untrusted-data guard marker found in any agent prompt "
        f"(checked: {UNTRUSTED_GUARD_MARKERS})"
    )


# ---------------------------------------------------------------------------
# 3) Runner grounding — fake LLM returns a finding on a NON-EXISTENT node id
# ---------------------------------------------------------------------------


def test_runner_filters_hallucinated_node_ids(monkeypatch):
    """A finding citing a node that does not exist in the graph must be
    filtered out of the final result; a valid node id must survive."""

    async def _canned(system_prompt: str, user_prompt: str, runtime=None) -> CompleteResult:
        payload = json.loads(json.dumps(CANNED_AGENT_REPORT))  # fresh copy per call
        return CompleteResult(data=payload, usage=None, attempts=1, ok=True)

    _patch_complete_json(monkeypatch, _canned)
    result = _run_analysis(G1_NODES, G1_EDGES, G1_NFR)

    finding_ids = {f.node_id for f in result.findings if f.node_id}
    assert GHOST_NODE_ID not in finding_ids, (
        f"hallucinated node id leaked into findings: {finding_ids}"
    )
    assert GHOST_NODE_ID not in result.node_scores, (
        f"hallucinated node id leaked into node_scores: {result.node_scores}"
    )
    assert result.score_breakdown is not None
    assert GHOST_NODE_ID not in result.score_breakdown.critical_node_ids, (
        f"hallucinated node id leaked into critical_node_ids: "
        f"{result.score_breakdown.critical_node_ids}"
    )
    assert G1_NODE_DB in result.node_scores, "valid node id must survive grounding"
