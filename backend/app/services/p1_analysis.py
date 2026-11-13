"""P1.2 — Analysis enrichments: fix actions, score breakdown, PII/saga/bounded-context checks."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.schemas.analysis import (
    AnalysisResult,
    DomainBenchmark,
    Finding,
    FixAction,
    ScoreBreakdown,
    ScoreFactor,
)

logger = logging.getLogger(__name__)

# Snapshot autoritativo dos ids de catálogo / zone kinds reais do front
# (web/src/lib). Regenerar quando o catálogo crescer:
#     cd web && UPDATE_CATALOG_SNAPSHOT=1 pnpm exec node --experimental-strip-types --test src/lib/catalog.integrity.test.ts
# (o bloco de integridade do test web reescreve o arquivo).
_CATALOG_SNAPSHOT_PATH = Path(__file__).with_name("catalog_snapshot.json")
_catalog_snapshot_cache: dict | None = None

# action_type aceitos em fix_action (espelha web/src/lib/fix-actions.ts + tipos
# emitidos por este módulo: update_node/set_nfr/note não têm aplicação
# automática no canvas, mas são payloads legítimos de "recomendação").
VALID_FIX_ACTION_TYPES = frozenset(
    {
        "select_node",
        "highlight_node",
        "add_zone",
        "add_catalog_node",
        "apply_pattern",
        "update_node",
        "set_nfr",
        "note",
    }
)

# Item 40 — constantes reais da fórmula de score (agents/runner.py + heuristic.py).
# A penalidade de severidade age sobre node_scores (nunca na nota final);
# a nota final é o blend 0.4×heurística + 0.6×consolidador (quando a IA participa).
SEVERITY_NODE_PENALTY: dict[str, float] = {
    "info": 0.0,
    "warning": -0.4,
    "critical": -1.0,
}
NODE_SCORE_FLOOR = 2.0
HEURISTIC_SCORE_WEIGHT = 0.4
CONSOLIDATOR_SCORE_WEIGHT = 0.6


def load_catalog_snapshot() -> dict:
    """Carrega (com cache) o snapshot de ids de catálogo válidos."""
    global _catalog_snapshot_cache
    if _catalog_snapshot_cache is None:
        with _CATALOG_SNAPSHOT_PATH.open("r", encoding="utf-8") as fh:
            _catalog_snapshot_cache = json.load(fh)
    return _catalog_snapshot_cache


def _payload_field(action: FixAction, snake_key: str, camel_key: str) -> object:
    """Lê um campo do payload aceitando os formatos antigo (payload) e novo
    (campo de 1ª classe do schema de fix_action) — tolerante à ausência."""
    payload = action.payload if isinstance(action.payload, dict) else {}
    for source in (
        lambda: payload.get(camel_key),
        lambda: payload.get(snake_key),
        lambda: getattr(action, snake_key, None),
    ):
        value = source()
        if value not in (None, ""):
            return value
    return None


def _fix_action_invalid_reason(action: FixAction, finding: Finding) -> str | None:
    """Valida um fix_action emitido (ex.: LLM). Retorna o motivo da rejeição,
    ou None quando válido. Campos ausentes não invalidam — a ação só precisa
    ser internamente coerente com o snapshot do catálogo."""
    snapshot = load_catalog_snapshot()
    catalog_ids = set(snapshot.get("catalog_ids") or [])
    zone_kinds = set(snapshot.get("zone_kinds") or [])

    action_type = getattr(action, "action_type", None)
    if action_type not in VALID_FIX_ACTION_TYPES:
        return f"action_type inválido: {action_type!r}"

    catalog_id = _payload_field(action, "catalog_id", "catalogId")
    if catalog_id is not None and catalog_id not in catalog_ids:
        return f"catalogId inexistente no catálogo: {catalog_id!r}"

    zone_kind = _payload_field(action, "zone_kind", "zoneKind")
    if zone_kind is not None and zone_kind not in zone_kinds:
        return f"zoneKind inválido: {zone_kind!r}"

    if action_type == "add_catalog_node" and catalog_id is None:
        return "add_catalog_node sem catalogId usável"

    if action_type == "apply_pattern":
        pattern_ids = (action.payload or {}).get("patternIds") or []
        if not pattern_ids:
            return "apply_pattern sem patternIds"
        unknown = [pid for pid in pattern_ids if pid not in catalog_ids]
        if unknown:
            return f"patternIds inexistentes no catálogo: {unknown}"

    if action_type in {"select_node", "highlight_node"}:
        node_id = _payload_field(action, "node_id", "node_id")
        if not node_id and not finding.node_id:
            return f"{action_type} sem node_id"

    return None


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
    """P1.2.1 — Preencher findings sem fix_action; validar os que já têm.

    Um fix_action já presente (ex.: emitido pelo LLM) é validado contra o
    snapshot do catálogo; falhou a validação, loga warning e cai no fallback
    por palavra-chave (que continua útil quando o LLM não emite fix_action).
    """
    out: list[Finding] = []
    for f in findings:
        if f.fix_action is not None:
            reason = _fix_action_invalid_reason(f.fix_action, f)
            if reason is None:
                out.append(f)
                continue
            logger.warning(
                "fix_action do finding %r rejeitada (%s) — usando fallback por palavra-chave",
                f.title,
                reason,
            )
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
                payload={"catalogId": "dep-cloudfront"},
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
    """P1.2.4 — Explains overall score.

    Ruling (item 40): factors are *non-additive contributions*, not a sum
    that reconstructs the final score. The real formula lives in
    agents/runner.py: final score = 0.4×heuristic + 0.6×consolidator (or the
    bare heuristic when IA is unavailable), and the per-severity penalties
    (SEVERITY_NODE_PENALTY) apply to node_scores (floor NODE_SCORE_FLOOR),
    never to the final score. The first row ("Score final") carries the
    actual number so the UI "Por que X?" stays truthful; the remaining rows
    show the documented node-level effects and qualitative context, each
    labeled as such in `detail`.
    """
    critical = sum(1 for f in result.findings if f.severity == "critical")
    warning = sum(1 for f in result.findings if f.severity == "warning")
    info = sum(1 for f in result.findings if f.severity == "info")

    factors: list[ScoreFactor] = [
        ScoreFactor(
            label="Score final",
            impact=round(result.score, 1),
            detail=(
                f"{HEURISTIC_SCORE_WEIGHT}×heurística + "
                f"{CONSOLIDATOR_SCORE_WEIGHT}×consolidador (quando a IA participa; "
                f"só heurística caso contrário). As linhas a seguir são efeitos "
                f"por nó / contexto — não somam a esta nota."
            ),
        ),
        ScoreFactor(
            label="Findings críticos",
            impact=round(critical * SEVERITY_NODE_PENALTY["critical"], 1),
            detail=(
                f"{critical} finding(s) crítico(s): "
                f"{SEVERITY_NODE_PENALTY['critical']:+.1f} em cada nó afetado "
                f"(node_scores, piso {NODE_SCORE_FLOOR}) — não afeta a nota final diretamente."
            ),
        ),
        ScoreFactor(
            label="Findings warning",
            impact=round(warning * SEVERITY_NODE_PENALTY["warning"], 1),
            detail=(
                f"{warning} aviso(s): "
                f"{SEVERITY_NODE_PENALTY['warning']:+.1f} em cada nó afetado "
                f"(node_scores) — não afeta a nota final diretamente."
            ),
        ),
        ScoreFactor(
            label="Pontos fortes",
            impact=0.0,
            detail=f"{len(result.strengths)} força(s) — contexto qualitativo; não entra na fórmula da nota.",
        ),
    ]

    if result.domain_coherence:
        dc = result.domain_coherence.geral
        factors.append(
            ScoreFactor(
                label="Coerência de domínio",
                impact=0.0,
                detail=f"Coerência geral {dc:.1f}/10 — contexto qualitativo; não entra na fórmula da nota.",
            )
        )

    if result.review_scorecard:
        rs = result.review_scorecard.overall
        factors.append(
            ScoreFactor(
                label="Review scorecard",
                impact=0.0,
                detail=f"Scorecard {rs:.1f}/10 — contexto qualitativo; não entra na fórmula da nota.",
            )
        )

    # A breakdown não recalcula a nota: explica a que já existe (fórmula do runner).
    explained = round(result.score, 1)
    critical_node_ids = [f.node_id for f in result.findings if f.severity == "critical" and f.node_id]

    return ScoreBreakdown(
        base_score=result.score,
        explained_score=explained,
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

    # Threat analysis (STRIDE + LINDDUN). R5: os fix_actions heurísticos
    # passam por `attach_fix_actions` (validação contra o snapshot do
    # catálogo, mesmo tratamento da via LLM) antes de entrar no resultado.
    threat_findings = attach_fix_actions(enrich_threat_analysis(nodes, edges, nfr))

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
