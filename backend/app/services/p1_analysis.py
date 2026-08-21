"""P1.2 — Analysis enrichments: fix actions, score breakdown, PII/saga/bounded-context checks."""

from __future__ import annotations

from app.schemas.analysis import (
    AnalysisResult,
    DomainBenchmark,
    Finding,
    FixAction,
    ScoreBreakdown,
    ScoreFactor,
)


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


def check_bounded_context_vs_shared_db(nodes: list[dict], edges: list[dict]) -> list[Finding]:
    """P1.1.1 — Warn when bounded contexts share a database."""
    from app.services.polyglot_map import build_polyglot_map

    pmap = build_polyglot_map(nodes, edges)
    findings: list[Finding] = []
    for shared in pmap.get("shared_databases") or []:
        if not shared.get("anti_pattern"):
            continue
        findings.append(
            Finding(
                severity="warning",
                title="Bounded context compartilhando banco",
                detail=(
                    f"O banco «{shared['database_label']}» é usado por "
                    f"{len(shared['services'])} serviços ({', '.join(shared['services'])}). "
                    "Em DDD/data mesh, cada bounded context deveria ter persistência própria."
                ),
                fix_action=FixAction(
                    action_type="add_zone",
                    label="Adicionar zona data_mesh",
                    payload={"zoneKind": "data_mesh", "label": "Data product zone"},
                ),
            )
        )
    return findings


def check_pii_in_sensitive_flow(nodes: list[dict], edges: list[dict]) -> list[Finding]:
    """P1.1.5 — PII database without encryption/identity on path."""
    findings: list[Finding] = []
    pii_dbs = [
        n
        for n in nodes
        if _node_data(n).get("kind") == "database"
        and _node_data(n).get("piiSensitivity") in {"high", "restricted", "medium"}
    ]
    if not pii_dbs:
        return findings

    has_identity = any(_node_data(n).get("kind") == "identity" for n in nodes)
    has_kms = any(
        "kms" in (_node_data(n).get("tech") or "").lower()
        or "vault" in (_node_data(n).get("catalogId") or "").lower()
        for n in nodes
    )

    for db in pii_dbs:
        nid = str(db.get("id"))
        sens = _node_data(db).get("piiSensitivity")
        label = _node_data(db).get("label") or nid
        if not has_identity:
            findings.append(
                Finding(
                    node_id=nid,
                    severity="critical" if sens == "restricted" else "warning",
                    title=f"PII ({sens}) sem camada de identidade",
                    detail=f"«{label}» armazena PII mas não há componente de identidade/auth no diagrama.",
                    fix_action=FixAction(
                        action_type="add_catalog_node",
                        label="Adicionar OIDC/OAuth",
                        payload={"catalogId": "pat-oidc"},
                    ),
                )
            )
        if not has_kms and sens in {"high", "restricted"}:
            findings.append(
                Finding(
                    node_id=nid,
                    severity="warning",
                    title="PII sem KMS/Vault explícito",
                    detail=f"«{label}» com sensibilidade {sens} — documente criptografia em repouso.",
                    fix_action=FixAction(
                        action_type="add_catalog_node",
                        label="Adicionar KMS",
                        payload={"catalogId": "pat-kms"},
                    ),
                )
            )
    return findings


def check_saga_for_distributed_tx(nodes: list[dict], edges: list[dict], nfr: dict | None) -> list[Finding]:
    """P1.1.4 — Microservices with sync chains but no saga/outbox."""
    nfr = nfr or {}
    style = nfr.get("arch_style") or ""
    backends = [n for n in nodes if _node_data(n).get("kind") == "backend"]
    if len(backends) < 2 and style not in {"microservices", "event_driven"}:
        return []

    has_saga = any(
        "saga" in (_node_data(n).get("tech") or "").lower()
        or "outbox" in (_node_data(n).get("catalogId") or "").lower()
        or _node_data(n).get("catalogId") in {"pat-saga", "pat-outbox"}
        for n in nodes
    )
    if has_saga:
        return []

    sync_chains = 0
    for e in edges:
        ed = e.get("data") or {}
        if ed.get("flowKind") == "sync" or ed.get("flow_kind") == "sync":
            sync_chains += 1

    if sync_chains >= 2:
        return [
            Finding(
                severity="warning",
                title="Transação distribuída sem Saga/Outbox",
                detail=(
                    f"{len(backends)} serviços com {sync_chains} fluxos síncronos — "
                    "considere Saga orchestrator ou Outbox pattern."
                ),
                fix_action=FixAction(
                    action_type="apply_pattern",
                    label="Aplicar Saga + Outbox",
                    payload={"patternIds": ["pat-saga", "pat-outbox"]},
                ),
            )
        ]
    return []


def attach_fix_actions(findings: list[Finding]) -> list[Finding]:
    """P1.2.1 — Generate fix actions for findings missing them."""
    out: list[Finding] = []
    for f in findings:
        if f.fix_action:
            out.append(f)
            continue
        title_lower = f.title.lower()
        fix: FixAction | None = None
        if "bottleneck" in title_lower or "gargalo" in title_lower:
            fix = FixAction(
                action_type="highlight_node",
                label="Destacar no canvas",
                payload={"node_id": f.node_id},
            )
        elif "cdn" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar CDN",
                payload={"catalogId": "aws-cloudfront"},
            )
        elif "monitor" in title_lower or "observ" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar observabilidade",
                payload={"catalogId": "pat-prometheus"},
            )
        elif "redis" in title_lower or "cache" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar Redis/Cache",
                payload={"catalogId": "db-redis"},
            )
        elif "queue" in title_lower or "kafka" in title_lower or "sqs" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar fila",
                payload={"catalogId": "int-kafka"},
            )
        elif "lb" in title_lower or "load balancer" in title_lower or "alb" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar Load Balancer",
                payload={"catalogId": "cloud-aws-alb"},
            )
        elif "security group" in title_lower or "sg" in title_lower or "firewall" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar Security Group",
                payload={"catalogId": "sec-sg"},
            )
        elif "zone" in title_lower or "subnet" in title_lower or "vpc" in title_lower:
            fix = FixAction(
                action_type="add_zone",
                label="Adicionar zona",
                payload={"zoneKind": "availability_zone"},
            )
        elif "database" in title_lower or "db" in title_lower:
            fix = FixAction(
                action_type="add_catalog_node",
                label="Adicionar banco",
                payload={"catalogId": "db-postgres"},
            )
        elif "multi" in title_lower or "redundancy" in title_lower or "ha" in title_lower:
            fix = FixAction(
                action_type="add_zone",
                label="Adicionar multi-AZ",
                payload={"zoneKind": "availability_zone"},
            )
        elif "saga" in title_lower or "outbox" in title_lower or "transaction" in title_lower:
            fix = FixAction(
                action_type="apply_pattern",
                label="Aplicar Saga/Outbox",
                payload={"patternIds": ["pat-saga", "pat-outbox"]},
            )
        elif "pii" in title_lower or "lgpd" in title_lower or "sensitive" in title_lower:
            fix = FixAction(
                action_type="update_node",
                label="Configurar PII/LGPD",
                payload={"piiSensitivity": "high"},
            )
        elif "slo" in title_lower or "availability" in title_lower or "uptime" in title_lower:
            fix = FixAction(
                action_type="set_nfr",
                label="Configurar SLO",
                payload={"slo_availability_pct": 99.9},
            )
        elif "cost" in title_lower or "pricing" in title_lower:
            fix = FixAction(
                action_type="note",
                label="Revisar custo",
                payload={"note": "Revisar tier de pricing e custos regionais"},
            )
        elif f.node_id:
            fix = FixAction(
                action_type="select_node",
                label="Selecionar componente",
                payload={"node_id": f.node_id},
            )
        out.append(f.model_copy(update={"fix_action": fix}) if fix else f)
    return out


def compute_score_breakdown(result: AnalysisResult, nodes: list[dict]) -> ScoreBreakdown:
    """P1.2.4 — Explain overall score."""
    critical = sum(1 for f in result.findings if f.severity == "critical")
    warning = sum(1 for f in result.findings if f.severity == "warning")
    info = sum(1 for f in result.findings if f.severity == "info")

    factors: list[ScoreFactor] = [
        ScoreFactor(
            label="Findings críticos",
            impact=-min(3.0, critical * 1.2),
            detail=f"{critical} finding(s) crítico(s) reduzem a nota.",
        ),
        ScoreFactor(
            label="Findings warning",
            impact=-min(2.0, warning * 0.4),
            detail=f"{warning} aviso(s) moderam a confiança.",
        ),
        ScoreFactor(
            label="Pontos fortes",
            impact=min(1.5, len(result.strengths) * 0.3),
            detail=f"{len(result.strengths)} força(s) identificada(s).",
        ),
    ]

    if result.domain_coherence:
        dc = result.domain_coherence.geral
        factors.append(
            ScoreFactor(
                label="Coerência de domínio",
                impact=(dc - 5) * 0.3,
                detail=f"Coerência geral {dc:.1f}/10.",
            )
        )

    if result.review_scorecard:
        rs = result.review_scorecard.overall
        factors.append(
            ScoreFactor(
                label="Review scorecard",
                impact=(rs - 5) * 0.2,
                detail=f"Scorecard {rs:.1f}/10.",
            )
        )

    explained = max(0.0, min(10.0, result.score + sum(f.impact for f in factors) * 0.1))
    critical_node_ids = [f.node_id for f in result.findings if f.severity == "critical" and f.node_id]

    return ScoreBreakdown(
        base_score=result.score,
        explained_score=round(explained, 1),
        factors=factors,
        critical_node_ids=[x for x in critical_node_ids if x],
        finding_counts={"critical": critical, "warning": warning, "info": info},
    )


def extract_domain_benchmarks(nodes: list[dict], edges: list[dict], nfr: dict | None) -> list[DomainBenchmark]:
    """P1.2.3 — Visible domain benchmarks summary."""
    from app.schemas.graph import ProjectNfr
    from app.services.architecture_heuristics import analyze_domain_benchmarks

    nfr_obj = ProjectNfr(**(nfr or {}))
    findings = analyze_domain_benchmarks(nodes, edges, nfr_obj)

    domains: dict[str, list[str]] = {}
    for f in findings:
        title = f.title.lower()
        domain = "general"
        if "fintech" in title or "payment" in title or "audit" in title:
            domain = "fintech"
        elif "stream" in title or "cdn" in title:
            domain = "streaming"
        elif "iot" in title or "mqtt" in title:
            domain = "iot"
        elif "e-commerce" in title or "checkout" in title or "inventory" in title:
            domain = "ecommerce"
        domains.setdefault(domain, []).append(f.title)

    return [
        DomainBenchmark(
            domain=dom,
            triggered_rules=titles,
            status="fail" if any("sem" in t.lower() or "inviável" in t.lower() for t in titles) else "pass",
        )
        for dom, titles in domains.items()
    ]


def enrich_analysis(result: AnalysisResult, nodes: list[dict], edges: list[dict], nfr: dict | None) -> AnalysisResult:
    """Apply all P1 analysis enrichments + ATAM scenarios."""
    from app.services.atam_analysis import (
        ATAM_SCENARIOS,
        analyze_atam_scenarios,
        link_atam_to_nodes,
    )
    from app.services.threat_analysis import enrich_threat_analysis
    from app.services.well_architected import calculate_well_architected_score

    # Threat analysis (STRIDE + LINDDUN)
    threat_findings = enrich_threat_analysis([], nodes, edges, nfr)

    # Well-Architected scorecard
    wa_scorecard = calculate_well_architected_score(nodes, edges, nfr)

    # ATAM scenario analysis
    atam_findings = analyze_atam_scenarios(nodes, edges, nfr)
    atam_links = link_atam_to_nodes(nodes, edges, list(ATAM_SCENARIOS.keys()))

    # Existing enrichments
    extra = (
        check_bounded_context_vs_shared_db(nodes, edges)
        + check_pii_in_sensitive_flow(nodes, edges)
        + check_saga_for_distributed_tx(nodes, edges, nfr)
    )
    all_findings = attach_fix_actions(list(result.findings) + extra + atam_findings)
    benchmarks = extract_domain_benchmarks(nodes, edges, nfr)
    updated = result.model_copy(update={
        "findings": all_findings,
        "benchmarks": benchmarks,
        "threat_findings": threat_findings,
        "well_architected": wa_scorecard,
        "atam_scenarios": atam_links,
    })
    breakdown = compute_score_breakdown(updated, nodes)
    return updated.model_copy(update={"score_breakdown": breakdown})
