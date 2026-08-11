from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.agents.prompts import (
    ARCHITECTURE_PROMPT,
    CODE_PROMPT,
    CONSOLIDATOR_PROMPT,
    DATABASE_PROMPT,
    SECURITY_PROMPT,
)
from app.schemas.analysis import AgentReport, AnalysisResult
from app.services.heuristic import analyze_graph
from app.services.omniroute import complete_json

logger = logging.getLogger(__name__)

AGENTS = (
    ("architecture", ARCHITECTURE_PROMPT),
    ("database", DATABASE_PROMPT),
    ("code", CODE_PROMPT),
    ("security", SECURITY_PROMPT),
)


def _graph_blob(nodes: list[dict], edges: list[dict], context: str = "", nfr: dict | None = None) -> str:
    slim_nodes = []
    for node in nodes:
        data = node.get("data") or {}
        slim_nodes.append(
            {
                "id": node.get("id"),
                "kind": data.get("kind"),
                "label": data.get("label"),
                "tech": data.get("tech"),
                "config": data.get("config"),
                "parentId": node.get("parentId"),
            }
        )
    slim_edges = [{"source": e.get("source"), "target": e.get("target")} for e in edges]
    return json.dumps(
        {
            "project_context": (context or "").strip(),
            "nfr": nfr or {},
            "nodes": slim_nodes,
            "edges": slim_edges,
        },
        ensure_ascii=False,
    )


def _coerce_agent(name: str, payload: dict[str, Any]) -> AgentReport | None:
    try:
        payload = {**payload, "agent": payload.get("agent") or name}
        if payload.get("growth") is None:
            payload["growth"] = {
                "small": {"ok": True, "issues": [], "changes": []},
                "medium": {"ok": True, "issues": [], "changes": []},
                "large": {"ok": False, "issues": [], "changes": []},
            }
        return AgentReport.model_validate(payload)
    except Exception:  # noqa: BLE001 — intentional catch-all for AI response parsing
        logger.warning("agent_payload_invalid agent=%s", name)
        return None


async def run_agent(name: str, prompt: str, graph_json: str) -> AgentReport | None:
    raw = await complete_json(
        prompt,
        "Avalie se esta arquitetura faz sentido para o projeto descrito em project_context.\n"
        "Se o contexto estiver vazio, diga isso nos riscos e analise só o grafo.\n"
        f"Arquitetura:\n{graph_json}",
    )
    if not raw:
        return None
    return _coerce_agent(name, raw)


def _merge(heuristic: AnalysisResult, reports: list[AgentReport], consolidator: AgentReport | None) -> AnalysisResult:
    findings = list(heuristic.findings)
    strengths = list(heuristic.strengths)
    risks = list(heuristic.risks)
    suggestions = list(heuristic.suggestions)
    node_scores = dict(heuristic.node_scores)
    agents_used = list(heuristic.agents_used)

    for report in reports:
        agents_used.append(report.agent)
        findings.extend(report.findings)
        strengths.extend(report.strengths)
        risks.extend(report.risks)
        suggestions.extend(report.suggestions)
        for finding in report.findings:
            if finding.node_id:
                current = node_scores.get(finding.node_id, 7.0)
                delta = {"info": 0.0, "warning": -0.4, "critical": -1.0}[finding.severity]
                node_scores[finding.node_id] = max(2.0, min(10.0, round(current + delta, 1)))

    score = heuristic.score
    summary = heuristic.summary
    growth = heuristic.growth
    if consolidator:
        agents_used.append("consolidator")
        score = round((heuristic.score * 0.4) + (consolidator.score * 0.6), 1)
        summary = next((item for item in consolidator.strengths if "Arquitetura:" in item), None)
        if not summary:
            summary = consolidator.strengths[0] if consolidator.strengths else heuristic.summary
        if consolidator.growth:
            growth = consolidator.growth
        strengths = consolidator.strengths or strengths
        risks = consolidator.risks or risks
        suggestions = consolidator.suggestions or suggestions
        findings.extend(consolidator.findings)

    ia_ok = any(name != "heuristic" for name in agents_used)

    def unique(items: list) -> list:
        return list(dict.fromkeys(items))

    return AnalysisResult(
        score=score,
        summary=summary if summary.startswith("Arquitetura:") else f"Arquitetura: {score}/10 — {summary}",
        strengths=unique(strengths)[:8],
        risks=unique(risks)[:8],
        suggestions=unique(suggestions)[:8],
        findings=findings[:40],
        node_scores=node_scores,
        growth=growth,
        ia_ok=ia_ok,
        ia_unavailable=not ia_ok,
        agents_used=unique(agents_used),
    )


async def analyze_architecture(
    nodes: list[dict],
    edges: list[dict],
    context: str = "",
    nfr: dict | None = None,
) -> AnalysisResult:
    heuristic = analyze_graph(nodes, edges)
    graph_json = _graph_blob(nodes, edges, context=context, nfr=nfr)

    results = await asyncio.gather(
        *[run_agent(name, prompt, graph_json) for name, prompt in AGENTS],
        return_exceptions=True,
    )
    reports: list[AgentReport] = []
    for item in results:
        if isinstance(item, AgentReport):
            reports.append(item)

    consolidator = None
    if reports:
        consolidator_raw = await complete_json(
            CONSOLIDATOR_PROMPT,
            "Consolide:\n"
            + json.dumps(
                {
                    "heuristic": heuristic.model_dump(),
                    "agents": [r.model_dump() for r in reports],
                },
                ensure_ascii=False,
            ),
        )
        if consolidator_raw:
            if "summary" in consolidator_raw and "strengths" in consolidator_raw:
                consolidator_raw.setdefault("strengths", [])
                if consolidator_raw.get("summary"):
                    consolidator_raw["strengths"] = [
                        str(consolidator_raw["summary"]),
                        *list(consolidator_raw.get("strengths") or []),
                    ]
            consolidator = _coerce_agent("consolidator", consolidator_raw)

    return _merge(heuristic, reports, consolidator)
