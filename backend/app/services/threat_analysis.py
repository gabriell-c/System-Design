"""P1.2.6 — STRIDE and LINDDUN threat analysis for architecture nodes."""

from __future__ import annotations

from app.schemas.analysis import Finding


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


def analyze_stride(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> list[Finding]:
    """STRIDE threat model: Spoofing, Tampering, Repudiation, Info Disclosure,
    DoS, Elevation of Privilege.
    """
    nfr = nfr or {}
    findings: list[Finding] = []

    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]
    zones = [n for n in nodes if _node_data(n).get("kind") == "zone"]

    def blob(n: dict) -> str:
        d = _node_data(n)
        return f"{d.get('label', '')} {d.get('tech', '')} {d.get('catalogId', '')}".lower()

    def matches(n: dict, *keys: str) -> bool:
        return any(k in blob(n) for k in keys)

    # Identity-related nodes
    identity_nodes = [n for n in cards if matches(n, "oidc", "oauth", "auth0", "keycloak", "identity", "cognito")]
    has_identity = len(identity_nodes) > 0

    # External-facing nodes
    external_nodes = [
        n for n in cards
        if matches(n, "alb", "nlb", "apigw", "api gateway", "load balancer", "cloudfront", "cdn", "nginx", "traefik", "envoy")
    ]

    # Trust boundaries
    [z for z in zones if _node_data(z).get("zoneKind") == "security_boundary"]

    # === SPOOFING ===
    if external_nodes and not has_identity:
        for node in external_nodes[:1]:
            findings.append(Finding(
                node_id=str(node.get("id")),
                severity="critical",
                title="Spoofing: sem autenticação em endpoint externo",
                detail=(
                    f"«{_node_data(node).get('label')}» expõe API publicamente "
                    "mas não há OIDC/OAuth/IAM visível no diagrama. "
                    "Qualquer um pode se passar por cliente legítimo."
                ),
                fix_action={"action_type": "add_catalog_node", "label": "Adicionar OIDC", "payload": {"catalogId": "pat-oidc"}},
            ))

    # === TAMPERING ===
    # Check for unsigned data in transit
    if not any(matches(n, "tls", "https", "ssl", "cert", "mTLS") for n in nodes):
        findings.append(Finding(
            severity="warning",
            title="Tampering: sem criptografia em trânsito documentada",
            detail="Nenhum certificado TLS/HTTPS/mTLS identificado no diagrama. Dados podem ser interceptados.",
            fix_action={"action_type": "add_zone", "label": "Adicionar zona TLS", "payload": {"zoneKind": "security_boundary"}},
        ))

    # === REPUDIATION ===
    # Check for audit logging
    audit_nodes = [n for n in cards if matches(n, "audit", "log", "immutable", "ledger", "cloudwatch", "splunk")]
    if len(cards) > 3 and not audit_nodes:
        findings.append(Finding(
            severity="warning",
            title="Repudiation: sem audit trail para ações",
            detail="Sistema com múltiplos serviços mas sem logging/audit visível. Não há como repudiar ações maliciosas.",
            fix_action={"action_type": "add_catalog_node", "label": "Adicionar audit log", "payload": {"catalogId": "pat-audit"}},
        ))

    # === INFORMATION DISCLOSURE ===
    # Check for PII without encryption
    pii_nodes = [n for n in cards if _node_data(n).get("piiSensitivity") in {"high", "restricted"}]
    encryption_nodes = [n for n in nodes if matches(n, "kms", "vault", "encrypt", "tls", "https")]
    if pii_nodes and not encryption_nodes:
        for node in pii_nodes[:2]:
            findings.append(Finding(
                node_id=str(node.get("id")),
                severity="critical",
                title=f"Info Disclosure: PII sem criptografia em {node.get('data', {}).get('piiSensitivity', 'unknown')}",
                detail=f"«{_node_data(node).get('label')}» armazena PII sensível sem KMS/Vault/TLS identificado.",
                fix_action={"action_type": "add_catalog_node", "label": "Adicionar KMS", "payload": {"catalogId": "pat-kms"}},
            ))

    # === DENIAL OF SERVICE ===
    if len(cards) > 0 and not any(matches(n, "waf", "ddos", "rate limit", "throttl") for n in cards):
        if external_nodes:
            findings.append(Finding(
                severity="warning",
                title="DoS: sem proteção contra ataques de negação de serviço",
                detail="APIs expostas sem WAF/Rate Limit/Throttling identificados.",
                fix_action={"action_type": "add_catalog_node", "label": "Adicionar WAF", "payload": {"catalogId": "pat-waf"}},
            ))

    # === ELEVATION OF PRIVILEGE ===
    # Check for IAM roles with broad permissions
    iam_nodes = [n for n in cards if matches(n, "iam", "role", "rbac", "acl", "permissions")]
    if not iam_nodes and has_identity:
        findings.append(Finding(
            severity="info",
            title="EoP: sem política de IAM visível",
            detail="Identidade configurada mas sem política de acesso (IAM/RBAC) documentada.",
        ))

    # === LINDDUN extension (Data-centric threats) ===
    # Linkability: data flows between entities that shouldn't share
    data_edges = [e for e in edges if _node_data(next((n for n in nodes if str(n.get("id")) == str(e.get("source"))), {})).get("kind") == "database"]
    if len(data_edges) > 5:
        findings.append(Finding(
            severity="info",
            title="LINDDUN-Linkability: muitos fluxos de dados conectam entidades",
            detail="Alta conectividade de dados pode permitir linkability entre entidades separadas.",
        ))

    # Identifiability: PII in logs/events
    if pii_nodes and any(matches(n, "kafka", "event", "log", "pubsub") for n in cards):
        findings.append(Finding(
            severity="warning",
            title="LINDDUN-Identifiability: PII pode vazar via eventos",
            detail="Dados sensíveis transmitidos por filas/eventos sem anonimização identificada.",
        ))

    # Non-repudiation
    if not audit_nodes and any(matches(n, "payment", "transaction", "order", "ledger") for n in cards):
        findings.append(Finding(
            severity="critical",
            title="LINDDUN-NonRepudiation: transações sem não-repúdio",
            detail="Serviço financeiro sem audit trail = risco de repúdio.",
        ))

    return findings


def analyze_linddun(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> list[Finding]:
    """LINDDUN threat model: Linkability, Identifiability,
    Non-repudiation, Detail exposure, Disclosed information,
    Unauthorized access, Non-compliance.
    """
    nfr = nfr or {}
    findings: list[Finding] = []
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]

    def blob(n: dict) -> str:
        d = _node_data(n)
        return f"{d.get('label', '')} {d.get('tech', '')} {d.get('catalogId', '')}".lower()

    def matches(n: dict, *keys: str) -> bool:
        return any(k in blob(n) for k in keys)

    pii_nodes = [n for n in cards if _node_data(n).get("piiSensitivity") in {"high", "restricted"}]

    # Detail exposure: sensitive data in logs
    log_nodes = [n for n in cards if matches(n, "log", "cloudwatch", "splunk", "datadog")]
    if pii_nodes and not log_nodes:
        findings.append(Finding(
            severity="warning",
            title="LINDDUN-Detail Exposure: PII em logs sem controle",
            detail="Dados sensíveis podem ser logados sem política de masking.",
        ))

    # Disclosed information: public APIs exposing internal details
    public_apis = [n for n in cards if matches(n, "public", "api", "rest", "graphql")]
    if public_apis and not any(matches(n, "mask", "anonym", "pseudonym", "tokenize") for n in cards):
        findings.append(Finding(
            severity="warning",
            title="LINDDUN-Disclosed Info: APIs públicas sem masking",
            detail="Dados internos podem vazar via respostas de API.",
        ))

    # Unauthorized access
    if not any(matches(n, "rbac", "acl", "permission", "iam") for n in cards) and len(cards) > 2:
        findings.append(Finding(
            severity="info",
            title="LINDDUN-Unauthorized Access: sem controle de acesso granular",
            detail="Múltiplos serviços sem política de acesso identificada.",
        ))

    # Non-compliance
    compliance = nfr.get("compliance", [])
    if compliance and not any(matches(n, "compliance", "gdpr", "lgpd", "hipaa", "pci") for n in cards):
        findings.append(Finding(
            severity="critical",
            title="LINDDUN-Non-Compliance: requisitos de compliance não endereçados",
            detail=f"Compliance richiesto: {', '.join(compliance)}. Nenhum componente de conformidade no diagrama.",
        ))

    return findings


def enrich_threat_analysis(
    findings: list[Finding],
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> list[Finding]:
    """Run both STRIDE and LINDDUN and combine results."""
    stride_findings = analyze_stride(nodes, edges, nfr)
    linddun_findings = analyze_linddun(nodes, edges, nfr)
    return list(findings) + stride_findings + linddun_findings
