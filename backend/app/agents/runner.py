from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.agents.prompts import (
    ARCHITECTURE_PROMPT,
    CODE_PROMPT,
    COHERENCE_PROMPT,
    CONSOLIDATOR_PROMPT,
    DATABASE_PROMPT,
    SECURITY_PROMPT,
    STYLE_PROMPT,
    TRADEOFFS_PROMPT,
    graph_data_block,
)
from app.models.user import User
from app.schemas.analysis import (
    AgentReport,
    AnalysisResult,
    Finding,
    GrowthReport,
    GrowthScenario,
    LlmUsage,
)
from app.schemas.arch_style import (
    CohesionCoupling,
    DomainCoherenceScore,
    ReviewScorecard,
    TradeOffEntry,
)
from app.services.architecture_heuristics import (
    analyze_domain_benchmarks,
    analyze_trust_and_dr,
    analyze_zone_structure,
    boost_style_from_zones,
    build_review_scorecard,
    check_domain_coherence,
    classify_architecture_style,
    compute_cohesion_coupling,
    detect_bottlenecks,
    suggest_trade_offs,
    validate_firewall_rules,
)
from app.services.heuristic import analyze_graph
from app.services.knowledge import GROWTH_TARGET_USERS, REQUESTS_PER_USER_PER_SECOND
from app.services.ai_settings import RuntimeAiConfig, load_runtime
from app.services.omniroute import CompleteResult, complete_json
from app.services.p1_analysis import enrich_analysis

logger = logging.getLogger(__name__)

GROWTH_LEVELS = ("small", "medium", "large")
# Prefixo do finding de capacidade que a análise heurística emite
# ("Capacidade estimada de <backend>") — é a fonte de dados de teto de RPS.
CAPACITY_FINDING_TITLE_PREFIX = "Capacidade estimada"
CAPACITY_METRIC_VALUE_RE = re.compile(r"^(\d+)\s*-\s*(\d+)$")  # "low-high req/s"

# Item 39 — valores canônicos de Finding.agent.
AGENT_HEURISTIC = "heuristica"
AGENT_CONSOLIDATOR = "consolidador"

# Item 23 — teto do blob de grafo enviado ao LLM (mesmo valor de
# MAX_ANALYZE_CONTEXT_CHARS em routes/graphs.py).
MAX_GRAPH_BLOB_CHARS = 20_000
# Item 23 — marcador que o LLM vê quando o blob foi truncado.
TRUNCATION_MARKER = "… (truncado)"
# Item 23 — metadados de aresta incluídos no blob (cortados primeiro ao truncar).
EDGE_META_KEYS = ("flowKind", "label", "isCriticalPath")
# Item 23 — extras de nó incluídos no blob (notes são cortados, mais longos
# primeiro, na última etapa da truncagem progressiva).
NODE_EXTRA_KEYS = ("piiSensitivity", "catalogId", "capacityContract", "notes")

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
    """Blob de grafo para o LLM, agora com metadados de aresta (flowKind,
    label, isCriticalPath) e extras de nó (piiSensitivity, notes, catalogId,
    capacityContract) — item 23.

    Guarda de contexto total (item 23): se o blob serializado ultrapassa
    MAX_GRAPH_BLOB_CHARS, truncamos de forma progressiva — (1) corta os
    metadados de aresta e (2) remove as notas de nó mais longas, uma a uma,
    sempre com o marcador TRUNCATION_MARKER ("… (truncado)") para o LLM saber
    que a entrada está incompleta.
    """
    # Chaves de nó/aresta que entram no blob (constantes nomeadas, sem
    # strings mágicas espalhadas).
    node_base_keys = ("id", "parentId")
    node_data_base_keys = ("kind", "label", "tech", "config")

    def _slim_node(node: dict, drop_note_ids: set[str]) -> dict:
        data = node.get("data") or {}
        slim: dict[str, Any] = {}
        for key in node_base_keys:
            value = node.get(key)
            if value is not None:
                slim[key] = value
        for key in node_data_base_keys:
            value = data.get(key)
            if value is not None:
                slim[key] = value
        for key in NODE_EXTRA_KEYS:
            if key == "notes" and str(node.get("id")) in drop_note_ids:
                continue
            value = data.get(key)
            if value is not None:
                slim[key] = value
        return slim

    def _slim_edge(edge: dict, include_meta: bool) -> dict:
        slim: dict[str, Any] = {"source": edge.get("source"), "target": edge.get("target")}
        if include_meta:
            data = edge.get("data") or {}
            meta = {k: data.get(k) for k in EDGE_META_KEYS if data.get(k) is not None}
            if meta:
                slim["data"] = meta
        return slim

    def _build(include_edge_meta: bool, drop_note_ids: set[str], truncated: bool) -> str:
        payload: dict[str, Any] = {
            "project_context": (context or "").strip(),
            "nfr": nfr or {},
            "nodes": [_slim_node(n, drop_note_ids) for n in nodes],
            "edges": [_slim_edge(e, include_edge_meta) for e in edges],
        }
        if truncated:
            payload["_truncated"] = TRUNCATION_MARKER
        return json.dumps(payload, ensure_ascii=False)

    blob = _build(True, set(), truncated=False)
    if len(blob) <= MAX_GRAPH_BLOB_CHARS:
        return blob

    # Passo 1 — corta os metadados de aresta.
    blob = _build(False, set(), truncated=True)
    if len(blob) <= MAX_GRAPH_BLOB_CHARS:
        return blob

    # Passo 2 — remove as notas de nó mais longas, uma a uma, até caber.
    note_lengths = [
        (len(str((n.get("data") or {}).get("notes") or "")), str(n.get("id"))) for n in nodes
    ]
    note_lengths.sort(key=lambda pair: (-pair[0], pair[1]))
    drop_ids: set[str] = set()
    for _length, node_id in note_lengths:
        drop_ids.add(node_id)
        blob = _build(False, drop_ids, truncated=True)
        if len(blob) <= MAX_GRAPH_BLOB_CHARS:
            return blob
    # Último recurso: todas as notas cortadas; estrutura base preservada.
    return blob


def _capacity_rps_from_heuristic(heuristic: AnalysisResult | None) -> int | None:
    """Teto de RPS (ordem de grandeza) derivado do finding de capacidade
    da análise heurística, ou None se a arquitetura não tem capacidade
    estimável (ex.: sem backend conhecido)."""
    if heuristic is None:
        return None
    for finding in heuristic.findings:
        if not finding.title.startswith(CAPACITY_FINDING_TITLE_PREFIX) or not finding.metric:
            continue
        match = CAPACITY_METRIC_VALUE_RE.match(finding.metric.value)
        if match:
            return int(match.group(2))
    return None


def derive_growth_assessment(heuristic: AnalysisResult | None = None) -> GrowthReport:
    """Derive a avaliação de crescimento para os níveis que a LLM não cobriu.

    ok por nível = capacidade derivada (teto de RPS do finding heurístico)
    >= alvo de RPS (usuários de GROWTH_TARGET_USERS * REQUESTS_PER_USER_PER_SECOND).
    Com dados insuficientes: ok=False e `why` dizendo que faltam dados —
    nunca se assume ok=True sem evidência (em especial no nível large).
    """
    capacity_rps = _capacity_rps_from_heuristic(heuristic)
    scenarios: dict[str, GrowthScenario] = {}
    for level in GROWTH_LEVELS:
        target_users = GROWTH_TARGET_USERS[level]
        target_rps = target_users * REQUESTS_PER_USER_PER_SECOND
        if capacity_rps is None:
            scenarios[level] = GrowthScenario(
                ok=False,
                why=(
                    f"Dados insuficientes para o nível {level}: capacidade de RPS não "
                    "derivável da análise heurística (dados de gargalo/capacidade faltando)."
                ),
            )
            continue
        scenarios[level] = GrowthScenario(
            ok=capacity_rps >= target_rps,
            why=(
                f"Derivado: capacidade ~{capacity_rps} RPS vs alvo ~{target_rps:g} RPS "
                f"({target_users:,} usuários)."
            ),
        )
    return GrowthReport(small=scenarios["small"], medium=scenarios["medium"], large=scenarios["large"])


def _coerce_agent(
    name: str,
    payload: dict[str, Any],
    fallback_growth: GrowthReport | None = None,
) -> AgentReport | None:
    try:
        payload = {**payload, "agent": payload.get("agent") or name}
        if payload.get("growth") is None:
            # LLM omitiu a avaliação de crescimento: deriva dos dados em vez
            # de assumir (small/medium ok=True, large ok=False) cegamente.
            payload["growth"] = (fallback_growth or derive_growth_assessment()).model_dump()
        return AgentReport.model_validate(payload)
    except Exception:  # noqa: BLE001 — intentional catch-all for AI response parsing
        logger.warning("agent_payload_invalid agent=%s", name)
        return None


async def _run_agent_call(
    name: str,
    prompt: str,
    graph_json: str,
    fallback_growth: GrowthReport | None,
    runtime: RuntimeAiConfig | None,
) -> tuple[AgentReport | None, CompleteResult]:
    """Executa UM agente e devolve (report, CompleteResult).

    O CompleteResult orienta os contadores agents_done/agents_failed e a
    agregação de Usage (item 27); report é None quando a chamada falhou ou
    o payload não validou contra o AgentReport.
    """
    result = await complete_json(prompt, _agent_user_prompt(graph_json), runtime=runtime)
    if not result.ok or result.data is None:
        return None, result
    return _coerce_agent(name, result.data, fallback_growth=fallback_growth), result


def _agent_user_prompt(graph_json: str) -> str:
    """Item 32 — o blob do grafo vai entre delimitadores de dados não confiáveis."""
    return (
        "Avalie se esta arquitetura faz sentido para o projeto descrito em project_context.\n"
        "Se o contexto estiver vazio, diga isso nos riscos e analise só o grafo.\n"
        + graph_data_block(graph_json)
    )


async def run_agent(
    name: str,
    prompt: str,
    graph_json: str,
    fallback_growth: GrowthReport | None = None,
    runtime: RuntimeAiConfig | None = None,
) -> AgentReport | None:
    report, _result = await _run_agent_call(name, prompt, graph_json, fallback_growth, runtime)
    return report


def _dedupe_findings(findings: list[Finding]) -> list[Finding]:
    """Dedup de findings por título normalizado (strip + casefold).

    Rephrasings exatos de títulos repetidos sobrevivem à igualdade de
    string bruta; normalizar (preservando a 1ª ocorrência, ordem estável)
    elimina duplicatas de capitalização/whitespace.
    """
    seen: set[str] = set()
    unique: list[Finding] = []
    for finding in findings:
        key = finding.title.strip().casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(finding)
    return unique


def _stamp_finding(finding: Finding, agent: str) -> Finding:
    """Item 39 — estampa a origem do finding no campo `agent`."""
    return finding.model_copy(update={"agent": agent})


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
    agents_done: int = 0,
    agents_failed: int = 0,
    usage: LlmUsage | None = None,
) -> AnalysisResult:
    # Item 39 — findings locais (heurística + injetados) são estampados
    # "heuristica"; findings de agente levam a chave do agente.
    findings = [_stamp_finding(f, AGENT_HEURISTIC) for f in heuristic.findings]
    strengths = list(heuristic.strengths)
    risks = list(heuristic.risks)
    suggestions = list(heuristic.suggestions)
    node_scores = dict(heuristic.node_scores)
    agents_used = list(heuristic.agents_used)

    for report in reports:
        agents_used.append(report.agent)
        findings.extend(_stamp_finding(f, report.agent) for f in report.findings)
        strengths.extend(report.strengths)
        risks.extend(report.risks)
        suggestions.extend(report.suggestions)
        for finding in report.findings:
            if finding.node_id:
                current = node_scores.get(finding.node_id, 7.0)
                delta = {"info": 0.0, "warning": -0.4, "critical": -1.0}[finding.severity]
                node_scores[finding.node_id] = max(2.0, min(10.0, round(current + delta, 1)))

    score = heuristic.score
    # Item 34 — summary vem do campo dedicado do consolidator; o hack
    # startswith("Arquitetura:") foi removido (mantido só como último
    # recurso quando o summary final sai vazio).
    summary = heuristic.summary
    growth = heuristic.growth
    if consolidator:
        agents_used.append("consolidator")
        score = round((heuristic.score * 0.4) + (consolidator.score * 0.6), 1)
        if consolidator.summary:
            summary = consolidator.summary
        elif consolidator.strengths:
            summary = consolidator.strengths[0]
        if consolidator.growth:
            growth = consolidator.growth
        strengths = consolidator.strengths or strengths
        risks = consolidator.risks or risks
        suggestions = consolidator.suggestions or suggestions
        findings.extend(_stamp_finding(f, AGENT_CONSOLIDATOR) for f in consolidator.findings)

    ia_ok = any(name != "heuristic" for name in agents_used)

    def unique(items: list) -> list:
        return list(dict.fromkeys(items))

    final_summary = (summary or "").strip()
    if not final_summary:
        # Último recurso (item 34): summary vazio → formato clássico.
        final_summary = f"Arquitetura: {score}/10"

    return AnalysisResult(
        score=score,
        summary=final_summary,
        strengths=unique(strengths)[:8],
        risks=unique(risks)[:8],
        suggestions=unique(suggestions)[:8],
        findings=_dedupe_findings(findings)[:40],
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
        agents_done=agents_done,
        agents_failed=agents_failed,
        usage=usage,
    )


def _resolve_runtime(db: Session | None, user: User | None) -> RuntimeAiConfig | None:
    """Item 28-be — runtime de LLM escopado ao usuário atual.

    Com db+user: usa as configurações do PRÓPRIO usuário (load_runtime
    escopado). Em falha de leitura da linha do usuário, cai para o
    comportamento de 1 argumento (apenas ambiente), espelhando
    omniroute.resolve_runtime. Sem db/user (ex.: testes sem contexto de
    usuário): None → complete_json mantém o fallback legado de ambiente.
    """
    if db is None or user is None:
        return None
    try:
        return load_runtime(db, user)
    except Exception:  # noqa: BLE001 — linha corrompida não derruba a análise
        logger.warning("ai_user_runtime_failed_using_env_fallback")
        try:
            return load_runtime(db)
        except Exception:  # noqa: BLE001 — sem usuário e sem ambiente: LLM legado decide
            logger.warning("ai_env_runtime_unavailable")
            return None


def _ground_result(result: AnalysisResult, nodes: list[dict]) -> AnalysisResult:
    """Item 24 — grounding: descarta findings/nó scores/ids críticos que
    aponte para node_id fora do grafo submetido (o LLM pode alucinar ids).

    Comparação exata de conjuntos (ids normalizados como str). Também limpa
    evidence_node_ids inválidas e estampa "heuristica" em findings locais
    que ainda não tenham origem (P1/ATAM/threat) — item 39.
    """
    valid_ids = {str(n.get("id")) for n in nodes if n.get("id") is not None}
    dropped = 0

    def _clean(findings: list[Finding]) -> list[Finding]:
        nonlocal dropped
        kept: list[Finding] = []
        for finding in findings:
            if finding.node_id is not None and str(finding.node_id) not in valid_ids:
                dropped += 1
                continue
            invalid_evidence = [i for i in finding.evidence_node_ids if str(i) not in valid_ids]
            if invalid_evidence:
                finding = finding.model_copy(
                    update={"evidence_node_ids": [i for i in finding.evidence_node_ids if str(i) in valid_ids]}
                )
            if finding.agent is None:
                finding = _stamp_finding(finding, AGENT_HEURISTIC)
            kept.append(finding)
        return kept

    updates: dict[str, Any] = {
        "findings": _clean(list(result.findings)),
        "style_findings": _clean(list(result.style_findings)),
        "threat_findings": _clean(list(result.threat_findings)),
    }

    kept_scores = {k: v for k, v in result.node_scores.items() if str(k) in valid_ids}
    dropped += len(result.node_scores) - len(kept_scores)
    updates["node_scores"] = kept_scores

    if result.score_breakdown is not None:
        kept_critical = [i for i in result.score_breakdown.critical_node_ids if str(i) in valid_ids]
        dropped += len(result.score_breakdown.critical_node_ids) - len(kept_critical)
        updates["score_breakdown"] = result.score_breakdown.model_copy(
            update={"critical_node_ids": kept_critical}
        )

    if dropped:
        logger.warning(
            "analysis_grounding_dropped count=%d valid_nodes=%d", dropped, len(valid_ids)
        )
    return result.model_copy(update=updates)


async def analyze_architecture(
    nodes: list[dict],
    edges: list[dict],
    context: str = "",
    nfr: dict | None = None,
    db: Session | None = None,
    user: User | None = None,
) -> AnalysisResult:
    heuristic = analyze_graph(nodes, edges)
    graph_json = _graph_blob(nodes, edges, context=context, nfr=nfr)
    # Item 28-be — LLM com as credenciais do usuário atual (ou fallback
    # legado quando a rota não passa contexto de usuário, como em testes).
    runtime = _resolve_runtime(db, user)

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
    # Findings reais (o hack antigo com type("Finding", ...) gerava objetos
    # sem os campos do schema e quebrava o model_copy do stamping — item 39).
    firewall_findings = [
        Finding(
            severity=f["severity"],
            node_id=f["node_id"],
            title=f["message"],
            detail=f["fix"],
            agent=AGENT_HEURISTIC,
        )
        for f in firewall_findings_raw
    ]
    review_scorecard = build_review_scorecard(
        nodes,
        edges,
        nfr_obj,
        trade_offs=trade_offs,
        domain_coherence=domain_coherence,
    )

    # Avaliação de crescimento derivada (fallback para LLMs que omitem growth):
    # usa os dados de capacidade da análise heurística + constantes de knowledge.
    derived_growth = derive_growth_assessment(heuristic)

    # Agentes de IA — o CompleteResult de cada chamada alimenta os
    # contadores agents_done/agents_failed e a agregação de Usage (item 27).
    calls = await asyncio.gather(
        *[_run_agent_call(name, prompt, graph_json, derived_growth, runtime) for name, prompt in AGENTS],
        return_exceptions=True,
    )
    reports: list[AgentReport] = []
    agent_results: list[CompleteResult] = []
    for item in calls:
        if isinstance(item, BaseException):
            logger.warning("agent_call_exception agent_error=%s", item)
            continue
        report, result = item
        agent_results.append(result)
        if report is not None:
            reports.append(report)
    agents_done = sum(1 for r in agent_results if r.ok)
    agents_failed = len(AGENTS) - agents_done

    consolidator = None
    consolidator_result: CompleteResult | None = None
    if reports:
        consolidator_result = await complete_json(
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
            runtime=runtime,
        )
        if consolidator_result.ok and consolidator_result.data:
            # Item 34 — "summary" agora é campo do próprio AgentReport;
            # o antigo hack de injetar summary em strengths foi removido.
            consolidator = _coerce_agent(AGENT_CONSOLIDATOR, consolidator_result.data, fallback_growth=derived_growth)
        if consolidator_result.ok:
            agents_done += 1
        else:
            agents_failed += 1

    # Item 27 — uso agregado (None-tolerante: 0 quando o provider não
    # reportou tokens em uma chamada; total_calls conta só chamadas HTTP).
    all_results = list(agent_results)
    if consolidator_result is not None:
        all_results.append(consolidator_result)
    usage = LlmUsage(
        prompt_tokens=sum(r.usage.prompt_tokens for r in all_results if r.usage is not None),
        completion_tokens=sum(r.usage.completion_tokens for r in all_results if r.usage is not None),
        total_calls=sum(1 for r in all_results if r.attempts > 0),
    )

    # Coletar style_findings dos agentes + zonas (item 39: estampado na origem).
    style_findings: list[Finding] = [_stamp_finding(f, AGENT_HEURISTIC) for f in zone_findings]
    for report in reports:
        if report.agent in {"style", "coherence", "tradeoffs"}:
            style_findings.extend(_stamp_finding(f, report.agent) for f in report.findings)

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
        agents_done=agents_done,
        agents_failed=agents_failed,
        usage=usage,
    )

    result = enrich_analysis(merged, nodes, edges, nfr)
    # Item 24 — grounding por último: cobre também os findings adicionados
    # pelos enriquecimentos P1/ATAM/threat e o score_breakdown recalculado.
    return _ground_result(result, nodes)
