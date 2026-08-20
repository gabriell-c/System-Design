from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.agents.prompts import (
    ARCHITECTURE_PROMPT,
    CODE_PROMPT,
    CONSOLIDATOR_PROMPT,
    COHERENCE_PROMPT,
    DATABASE_PROMPT,
    SECURITY_PROMPT,
    STYLE_PROMPT,
    TRADEOFFS_PROMPT,
)
from app.schemas.analysis import AgentReport, AnalysisResult
from app.schemas.arch_style import CohesionCoupling, DomainCoherenceScore, ReviewScorecard, TradeOffEntry
from app.services.architecture_heuristics import (
    analyze_domain_benchmarks,
    analyze_zone_structure,
    boost_style_from_zones,
    build_review_scorecard,
    check_domain_coherence,
    classify_architecture_style,
    compute_cohesion_coupling,
    detect_bottlenecks,
    analyze_trust_and_dr,
    suggest_trade_offs,
    validate_firewall_rules,
)
from app.services.heuristic import analyze_graph
from app.services.omniroute import complete_json
from app.services.p1_analysis import enrich_analysis

logger = logging.getLogger(__name__)

AGENTS = (
    ("architecture", ARCHITECTURE_PROMPT),
    ("database", DATABASE_PROMPT),
    ("code", CODE_PROMPT),
    ("security", SECURITY_PROMPT),
    # NOVOS AGENTES
    ("style", STYLE_PROMPT),
    ("coherence", COHERENCE_PROMPT),
    ("tradeoffs", TRADEOFFS_PROMPT),
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


def _merge(
    heuristic: AnalysisResult,
    reports: list[AgentReport],
    consolidator: AgentReport | None,
    arch_style: str | None = None,
    style_confidence: float = 0.0,
    domain_coherence: DomainCoherenceScore | None = None,
    cohesion_coupling: CohesionCoupling | None = None,
    trade_offs: list[TradeOffEntry] | None = None,
    style_findings: list[Any] | None = None,
    review_scorecard: ReviewScorecard | None = None,
) -> AnalysisResult:
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
        arch_style=arch_style,
        style_confidence=style_confidence,
        domain_coherence=domain_coherence,
        cohesion_coupling=cohesion_coupling,
        trade_offs=trade_offs or [],
        style_findings=style_findings or [],
        review_scorecard=review_scorecard,
    )


async def analyze_architecture(
    nodes: list[dict],
    edges: list[dict],
    context: str = "",
    nfr: dict | None = None,
) -> AnalysisResult:
    heuristic = analyze_graph(nodes, edges)
    graph_json = _graph_blob(nodes, edges, context=context, nfr=nfr)

    # Heurísticas locais (sem IA)
    nfr_obj = None
    if nfr:
        from app.schemas.graph import ProjectNfr
        nfr_obj = ProjectNfr(**nfr)

    arch_style, style_confidence = classify_architecture_style(nodes, edges, nfr_obj)
    arch_style, style_confidence = boost_style_from_zones(nodes, arch_style, style_confidence)
    domain_coherence = check_domain_coherence(nodes, edges, nfr_obj)
    cohesion_coupling = compute_cohesion_coupling(nodes, edges)
    trade_offs = suggest_trade_offs(nodes, edges, nfr_obj)
    zone_findings = analyze_zone_structure(nodes, edges)
    bottleneck_findings = detect_bottlenecks(nodes, edges, nfr_obj)
    trust_findings = analyze_trust_and_dr(nodes, edges, nfr_obj)
    firewall_findings_raw = validate_firewall_rules(nodes, edges)
    firewall_findings = [type("Finding", (), {"severity": f["severity"], "node_id": f["node_id"], "title": f["message"], "fix": f["fix"]})() for f in firewall_findings_raw]
    review_scorecard = build_review_scorecard(
        nodes,
        edges,
        nfr_obj,
        trade_offs=trade_offs,
        domain_coherence=domain_coherence,
    )

    # Agentes de IA
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
                    "arch_style": arch_style,
                    "domain_coherence": domain_coherence.model_dump() if domain_coherence else None,
                    "cohesion_coupling": cohesion_coupling.model_dump() if cohesion_coupling else None,
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

    # Coletar style_findings dos agentes + zonas
    style_findings = list(zone_findings)
    for report in reports:
        if report.agent in {"style", "coherence", "tradeoffs"}:
            style_findings.extend(report.findings)

    # Injeta riscos de zona + bottlenecks + firewall + domain benchmarks no relatório heurístico
    benchmark_findings = list(analyze_domain_benchmarks(nodes, edges, nfr_obj))
    extra_findings = list(zone_findings) + list(bottleneck_findings) + firewall_findings + benchmark_findings + list(trust_findings)
    if extra_findings:
        heuristic = heuristic.model_copy(
            update={
                "findings": list(heuristic.findings) + extra_findings,
                "risks": list(heuristic.risks)
                + [zf.title for zf in extra_findings if zf.severity in {"warning", "critical"}],
            }
        )

    merged = _merge(
        heuristic,
        reports,
        consolidator,
        arch_style=arch_style,
        style_confidence=style_confidence,
        domain_coherence=domain_coherence,
        cohesion_coupling=cohesion_coupling,
        trade_offs=trade_offs,
        style_findings=style_findings,
        review_scorecard=review_scorecard,
    )

    return enrich_analysis(merged, nodes, edges, nfr)
