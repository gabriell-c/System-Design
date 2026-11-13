"""Testes do service de threat analysis (STRIDE + LINDDUN) — R4 do PLAN.

Para CADA check: condição de disparo E de silêncio (nó que mata o check),
dedup cross-model, ids de fix_action ∈ snapshot do catálogo, campo `model`,
O(n) via `_index_by_id` e grafo vazio.
"""

from __future__ import annotations

import inspect

import app.services.threat_analysis as threat
from app.services import security_caps
from app.services.p1_analysis import load_catalog_snapshot
from app.services.threat_analysis import (
    analyze_linddun,
    analyze_stride,
    enrich_threat_analysis,
)


def _node(node_id: str, *, catalog_id: str = "", label: str = "", tech: str = "", kind: str = "cloud", **extra):
    data = {"kind": kind, "label": label, "tech": tech}
    if catalog_id:
        data["catalogId"] = catalog_id
    data.update(extra)
    return {"id": node_id, "data": data}


def _titles(findings: list) -> list[str]:
    return [f.title for f in findings]


def _has(findings: list, title: str) -> bool:
    return title in _titles(findings)


def _all_triggered() -> list:
    """Grafo que dispara os 5 checks com fix_action (nginx external via
    fallback; sem TLS/WAF/IAM/audit no grafo)."""
    nodes = [
        _node("ng", label="Edge Proxy", tech="Nginx"),
        _node("s1", label="Svc A"),
        _node("s2", label="Svc B"),
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="high"),
    ]
    return enrich_threat_analysis(nodes, [])


# ---------------------------------------------------------------------------
# Contrato de assinatura (A2 consome)
# ---------------------------------------------------------------------------

def test_signatures_match_contract():
    assert "nfr" not in inspect.signature(analyze_stride).parameters
    assert "findings" not in inspect.signature(enrich_threat_analysis).parameters
    assert list(inspect.signature(enrich_threat_analysis).parameters)[:3] == ["nodes", "edges", "nfr"]
    assert "nfr" in inspect.signature(analyze_linddun).parameters


# ---------------------------------------------------------------------------
# Grafo vazio
# ---------------------------------------------------------------------------

def test_empty_graph_no_findings():
    assert enrich_threat_analysis([], []) == []


# ---------------------------------------------------------------------------
# Spoofing
# ---------------------------------------------------------------------------

def test_spoofing_fires_on_external_without_identity():
    findings = enrich_threat_analysis([_node("alb", catalog_id="cloud-aws-alb", label="Load Balancer", tech="AWS ALB")], [])
    assert _has(findings, "Spoofing: sem autenticação em endpoint externo")


def test_spoofing_silenced_by_pat_oidc():
    nodes = [
        _node("alb", catalog_id="cloud-aws-alb", label="Load Balancer", tech="AWS ALB"),
        _node("oidc", catalog_id="pat-oidc", label="OIDC", tech="OpenID Connect", kind="tool"),
    ]
    assert not _has(enrich_threat_analysis(nodes, []), "Spoofing: sem autenticação em endpoint externo")


# ---------------------------------------------------------------------------
# Tampering
# ---------------------------------------------------------------------------

def test_tampering_fires_without_tls():
    findings = enrich_threat_analysis([_node("s1", label="Svc A")], [])
    assert _has(findings, "Tampering: sem criptografia em trânsito documentada")


def test_tampering_silenced_by_cloudfront():
    nodes = [
        _node("s1", label="Svc A"),
        _node("cf", catalog_id="cloud-aws-cf", label="CloudFront", tech="AWS CloudFront"),
    ]
    assert not _has(enrich_threat_analysis(nodes, []), "Tampering: sem criptografia em trânsito documentada")


def test_tampering_fix_payload_has_zone_label():
    f = next(f for f in enrich_threat_analysis([_node("s1", label="Svc A")], []) if "Tampering" in f.title)
    assert f.fix_action is not None
    assert f.fix_action.action_type == "add_zone"
    assert f.fix_action.payload.get("zoneKind") == "security_boundary"
    assert f.fix_action.payload.get("label") == "Zona TLS"


# ---------------------------------------------------------------------------
# Repudiation
# ---------------------------------------------------------------------------

def test_repudiation_fires_on_many_cards_without_audit():
    nodes = [_node(f"s{i}", label=f"Svc {i}") for i in range(4)]
    assert _has(enrich_threat_analysis(nodes, []), "Repudiation: sem audit trail para ações")


def test_repudiation_silenced_by_pat_loki():
    nodes = [_node(f"s{i}", label=f"Svc {i}") for i in range(4)]
    nodes.append(_node("loki", catalog_id="pat-loki", label="Loki Logging", tech="Loki", kind="tool"))
    assert not _has(enrich_threat_analysis(nodes, []), "Repudiation: sem audit trail para ações")


# ---------------------------------------------------------------------------
# Info Disclosure
# ---------------------------------------------------------------------------

def test_info_disclosure_fires_on_pii_without_kms():
    nodes = [
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="high"),
    ]
    findings = enrich_threat_analysis(nodes, [])
    titles = _titles(findings)
    assert "Info Disclosure: PII sem criptografia em dados high" in titles
    assert all("unknown" not in t for t in titles)


def test_info_disclosure_silenced_by_pat_kms():
    nodes = [
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="restricted"),
        _node("kms", catalog_id="pat-kms", label="KMS", tech="Key Management Service", kind="service"),
    ]
    assert not any("Info Disclosure" in t for t in _titles(enrich_threat_analysis(nodes, [])))


# ---------------------------------------------------------------------------
# DoS
# ---------------------------------------------------------------------------

def test_dos_fires_on_external_without_waf():
    nodes = [
        _node("alb", catalog_id="cloud-aws-alb", label="Load Balancer", tech="AWS ALB"),
        _node("s1", label="Svc A"),
    ]
    assert _has(enrich_threat_analysis(nodes, []), "DoS: sem proteção contra ataques de negação de serviço")


def test_dos_silenced_by_sec_waf():
    nodes = [
        _node("alb", catalog_id="cloud-aws-alb", label="Load Balancer", tech="AWS ALB"),
        _node("s1", label="Svc A"),
        _node("waf", catalog_id="sec-waf", label="WAF (Firewall de Aplicação)", tech="WAF", kind="security"),
    ]
    assert not _has(enrich_threat_analysis(nodes, []), "DoS: sem proteção contra ataques de negação de serviço")


# ---------------------------------------------------------------------------
# EoP / LINDDUN-Unauthorized
# ---------------------------------------------------------------------------

def test_eop_fires_when_identity_without_iam():
    # 2 cards: LINDDUN-Unauthorized exige > ACCESS_MIN_CARDS (2), então a
    # dedup não corta o EoP aqui.
    nodes = [
        _node("oidc", catalog_id="pat-oidc", label="OIDC", tech="OpenID Connect", kind="tool"),
        _node("s1", label="Svc A"),
    ]
    assert _has(enrich_threat_analysis(nodes, []), "EoP: sem política de IAM visível")


def test_eop_and_unauthorized_silenced_by_sec_iam_role():
    nodes = [
        _node("oidc", catalog_id="pat-oidc", label="OIDC", tech="OpenID Connect", kind="tool"),
        _node("s1", label="Svc A"),
        _node("s2", label="Svc B"),
        _node("iam", catalog_id="sec-iam-role", label="IAM Role", tech="IAM Role", kind="identity"),
    ]
    findings = enrich_threat_analysis(nodes, [])
    assert not _has(findings, "EoP: sem política de IAM visível")
    assert not _has(findings, "LINDDUN-Unauthorized Access: sem controle de acesso granular")


def test_linddun_unauthorized_fires_on_many_cards_without_iam():
    nodes = [_node(f"s{i}", label=f"Svc {i}") for i in range(3)]
    assert _has(enrich_threat_analysis(nodes, []), "LINDDUN-Unauthorized Access: sem controle de acesso granular")


# ---------------------------------------------------------------------------
# LINDDUN-Identifiability
# ---------------------------------------------------------------------------

def test_identifiability_pii_with_kafka():
    nodes = [
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="high"),
        _node("kafka", catalog_id="int-kafka", label="Kafka", tech="Apache Kafka", kind="integration"),
    ]
    assert _has(enrich_threat_analysis(nodes, []), "LINDDUN-Identifiability: PII pode vazar via eventos")


def test_identifiability_silenced_without_event_bus():
    nodes = [
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="high"),
        _node("s1", label="Svc A"),
    ]
    assert not _has(enrich_threat_analysis(nodes, []), "LINDDUN-Identifiability: PII pode vazar via eventos")


def test_pattern_outside_map_gives_no_caps():
    """FP antigo: 'pat-event-driven' no blob casava com a chave nua 'event'.
    Padrão fora do mapa não é controle de segurança → Identifiability não
    dispara por causa dele."""
    nodes = [
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="high"),
        _node("pat", catalog_id="pat-event-driven", label="Event-Driven", tech="Event-Driven", kind="backend"),
    ]
    assert not _has(enrich_threat_analysis(nodes, []), "LINDDUN-Identifiability: PII pode vazar via eventos")


# ---------------------------------------------------------------------------
# LINDDUN-Linkability
# ---------------------------------------------------------------------------

def test_linkability_fires_above_threshold():
    db = _node("db1", catalog_id="db-postgres", label="Main DB", kind="database")
    nodes = [db, *(_node(f"c{i}", label=f"Cons {i}") for i in range(6))]
    edges = [{"id": f"e{i}", "source": "db1", "target": f"c{i}"} for i in range(6)]
    assert _has(enrich_threat_analysis(nodes, edges), "LINDDUN-Linkability: muitos fluxos de dados conectam entidades")


def test_linkability_silent_at_threshold():
    db = _node("db1", catalog_id="db-postgres", label="Main DB", kind="database")
    nodes = [db, *(_node(f"c{i}", label=f"Cons {i}") for i in range(5))]
    edges = [{"id": f"e{i}", "source": "db1", "target": f"c{i}"} for i in range(5)]
    assert not _has(enrich_threat_analysis(nodes, edges), "LINDDUN-Linkability: muitos fluxos de dados conectam entidades")


# ---------------------------------------------------------------------------
# LINDDUN-NonCompliance + typo
# ---------------------------------------------------------------------------

def test_noncompliance_fires_with_nfr_and_uses_honest_text():
    nodes = [_node(f"s{i}", label=f"Svc {i}") for i in range(3)]
    findings = analyze_linddun(nodes, [], {"compliance": ["LGPD", "SOX"]})
    f = next(f for f in findings if "Non-Compliance" in f.title)
    assert f.severity == "critical"
    assert "Compliance solicitado: LGPD, SOX" in f.detail
    assert "richiesto" not in f.detail


def test_noncompliance_silenced_by_sec_config():
    nodes = [_node(f"s{i}", label=f"Svc {i}") for i in range(3)]
    nodes.append(_node("cfg", catalog_id="sec-config", label="Config Recorder / Compliance", tech="Config", kind="security"))
    assert not _has(analyze_linddun(nodes, [], {"compliance": ["LGPD"]}), "LINDDUN-Non-Compliance: requisitos de compliance não endereçados")


def test_richiesto_typo_absent_from_source():
    src = inspect.getsource(threat)
    assert "richiesto" not in src


# ---------------------------------------------------------------------------
# Dedup cross-model
# ---------------------------------------------------------------------------

def _fintech_nodes() -> list[dict]:
    """Fintech: PII + pagamento + sem audit; TLS/WAF/IAM presentes para
    manter só o crítico no resultado."""
    return [
        _node("cf", catalog_id="cloud-aws-cf", label="CloudFront", tech="AWS CloudFront"),
        _node("oidc", catalog_id="pat-oidc", label="OIDC", tech="OpenID Connect", kind="tool"),
        _node("pay", label="Serviço de Pagamentos"),
        _node("db1", catalog_id="db-postgres", label="Main DB", kind="database", piiSensitivity="high"),
        _node("waf", catalog_id="sec-waf", label="WAF (Firewall de Aplicação)", tech="WAF", kind="security"),
        _node("iam", catalog_id="sec-iam-role", label="IAM Role", tech="IAM Role", kind="identity"),
    ]


def test_dedup_nonrepudiation_cuts_repudiation():
    findings = enrich_threat_analysis(_fintech_nodes(), [])
    # O critical (mesma causa-raiz) vence o warning STRIDE.
    assert _has(findings, "LINDDUN-NonRepudiation: transações sem não-repúdio")
    assert not _has(findings, "Repudiation: sem audit trail para ações")
    # Sem nenhum controle no grafo, o que resta: críticos (NonRep + Info
    # Disclosure) e o Detail Exposure (warning — mesma condição PII+sem audit).
    assert {f.severity for f in findings} <= {"critical", "warning"}
    assert _has(findings, "Info Disclosure: PII sem criptografia em dados high")


def test_dedup_unauthorized_cuts_eop():
    nodes = [
        _node("s1", label="Svc A"),
        _node("oidc", catalog_id="pat-oidc", label="OIDC", tech="OpenID Connect", kind="tool"),
        _node("mtls", catalog_id="sec-mtls", label="mTLS (autenticação mútua)", tech="mTLS", kind="security"),
    ]
    findings = enrich_threat_analysis(nodes, [])
    assert _has(findings, "LINDDUN-Unauthorized Access: sem controle de acesso granular")
    assert not _has(findings, "EoP: sem política de IAM visível")
    assert all(f.severity == "info" for f in findings)


# ---------------------------------------------------------------------------
# fix_action: todo id ∈ snapshot do catálogo (trava contra id fantasma)
# ---------------------------------------------------------------------------

def test_all_fix_action_ids_exist_in_snapshot():
    snapshot = load_catalog_snapshot()
    catalog_ids = set(snapshot["catalog_ids"])
    zone_kinds = set(snapshot["zone_kinds"])
    findings = _all_triggered()
    assert findings, "grafo de teste deveria disparar findings com fix_action"
    for f in findings:
        if f.fix_action is None:
            continue
        payload = f.fix_action.payload or {}
        cid = payload.get("catalogId")
        if cid is not None:
            assert cid in catalog_ids, f"catalogId fantasma no fix_action: {cid!r}"
        zk = payload.get("zoneKind")
        if zk is not None:
            assert zk in zone_kinds, f"zoneKind inválido no fix_action: {zk!r}"
    # Ids fantasmas antigos saíram do código.
    assert all(
        (f.fix_action.payload or {}).get("catalogId") not in {"pat-audit", "pat-waf"}
        for f in findings if f.fix_action
    )


def test_security_caps_map_ids_exist_in_snapshot():
    """Todo catalogId curado no mapa existe no catálogo (override só de id real)."""
    catalog_ids = set(load_catalog_snapshot()["catalog_ids"])
    missing = [k for k in security_caps.SECURITY_CAPS if k not in catalog_ids]
    assert missing == []
    for caps in security_caps.SECURITY_CAPS.values():
        assert caps <= set(security_caps.CAPS)


# ---------------------------------------------------------------------------
# Campo `model` em todo finding heurístico
# ---------------------------------------------------------------------------

def test_model_present_on_every_heuristic_finding():
    nodes = _fintech_nodes() + [_node("s9", label="Extra Svc")]
    findings = enrich_threat_analysis(nodes, [])
    assert findings
    assert all(f.model in {"stride", "linddun"} for f in findings)


def test_stride_linddun_lists_carry_model():
    findings = analyze_stride([_node("s1", label="Svc A")], []) + analyze_linddun([_node("s1", label="Svc A")], [])
    assert findings
    assert all(f.model in {"stride", "linddun"} for f in findings)


# ---------------------------------------------------------------------------
# O(n): índice id→nó construído uma vez por análise (não por aresta)
# ---------------------------------------------------------------------------

def test_index_by_id_built_once_per_analysis(monkeypatch):
    calls: list[None] = []

    def counting_index(nodes):
        calls.append(None)
        return {str(n.get("id")): n for n in nodes if n.get("id")}

    monkeypatch.setattr(threat, "_index_by_id", counting_index)
    db = _node("db1", label="Main DB", kind="database")
    nodes = [db, *(_node(f"c{i}", label=f"Cons {i}") for i in range(50))]
    edges = [{"id": f"e{i}", "source": "db1", "target": f"c{i}"} for i in range(50)]
    enrich_threat_analysis(nodes, edges)
    # Construído 1× (no analyze_stride, único consumidor de edges) —
    # NÃO por aresta (data_edges era O(n·m); agora O(n+m)).
    assert len(calls) == 1
