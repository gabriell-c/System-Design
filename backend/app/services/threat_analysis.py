"""P1.2.6 — Threat analysis heurística (STRIDE + LINDDUN) para nós de arquitetura.

Triagem determinística (NÃO substitui threat model formal). Controles de
segurança são detectados por `security_caps.has_cap` (mapa curado por
catalogId + fallback label+tech); o `catalogId` saiu do blob de matching
(fim dos FPs "pat-event-driven"→"event", "cloud-aws-alb"→"alb").

Contrato fixo (consumido por `p1_analysis.enrich_analysis` e, depois, pela
rota de threat):

- `analyze_stride(nodes, edges)` — SEM `nfr` (não era usada nestes checks).
- `analyze_linddun(nodes, edges, nfr=None)` — `nfr` entra apenas no check
  de não-conformidade.
- `enrich_threat_analysis(nodes, edges, nfr=None)` — os dois modelos +
  dedup cross-model (LINDDUN mais genérico/crítico corta o STRIDE).

Todo finding heurístico carrega `model` ("stride" | "linddun").
"""

from __future__ import annotations

from app.schemas.analysis import Finding
from app.services.security_caps import has_cap

# Limiares dos checks (magic numbers fora).
MAX_SPOOFING_NODES = 1
MAX_PII_NODES = 2
AUDIT_MIN_CARDS = 3
ACCESS_MIN_CARDS = 2
LINKABILITY_DATA_EDGE_THRESHOLD = 5

PII_SENSITIVITIES = {"high", "restricted"}

# Detecção de RISCO (não de controle — não vira cap): chaves nuas em
# label+tech para exposição externa e exposição financeira (stems cobrem
# pt-BR: "pagamentos", "transações", "pedidos").
EXTERNAL_KEYS = ("alb", "nlb", "apigw", "api gateway", "load balancer", "cloudfront", "cdn", "nginx", "traefik", "envoy")
PAYMENT_KEYS = ("payment", "pagament", "transa", "order", "pedido", "ledger")

# Títulos exatos — usados pela dedup cross-model em `enrich_threat_analysis`.
TITLE_STRIDE_REPUDIATION = "Repudiation: sem audit trail para ações"
TITLE_STRIDE_EOP = "EoP: sem política de IAM visível"
TITLE_LINDDUN_NONREP = "LINDDUN-NonRepudiation: transações sem não-repúdio"
TITLE_LINDDUN_UNAUTHORIZED = "LINDDUN-Unauthorized Access: sem controle de acesso granular"


def _node_data(node: dict | None) -> dict:
    data = (node or {}).get("data")
    return data if isinstance(data, dict) else {}


def _cards(nodes: list[dict]) -> list[dict]:
    """Nós de serviço (card): exclui zona, block e nó sem kind."""
    return [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]


def _index_by_id(nodes: list[dict]) -> dict[str, dict]:
    """Índice id→nó construído UMA vez por análise (data_edges fica O(n+m))."""
    return {str(n.get("id")): n for n in nodes if n.get("id")}


def _blob(n: dict) -> str:
    """Só `label + tech` (lowercased) — `catalogId` não entra (FP antigo)."""
    d = _node_data(n)
    return f"{d.get('label', '')} {d.get('tech', '')}".lower()


def _matches(n: dict, *keys: str) -> bool:
    return any(k in _blob(n) for k in keys)


def analyze_stride(
    nodes: list[dict],
    edges: list[dict],
) -> list[Finding]:
    """STRIDE (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, EoP)
    + checks de dados LINDDUN (Linkability, Identifiability, NonRepudiation)
    que dependem de nós/arestas, sem NFR.
    """
    findings: list[Finding] = []
    cards = _cards(nodes)
    by_id = _index_by_id(nodes)

    has_identity = has_cap(cards, "identity")
    external_nodes = [
        n for n in cards
        if has_cap([n], "public_api") or _matches(n, *EXTERNAL_KEYS)
    ]

    # === SPOOFING ===
    if external_nodes and not has_identity:
        for node in external_nodes[:MAX_SPOOFING_NODES]:
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
                model="stride",
            ))

    # === TAMPERING ===
    # Sem TLS documentado (cap `tls` do mapa ou fallback label+tech).
    # Só faz sentido com serviços (cards) no grafo — vazio = 0 findings.
    if cards and not has_cap(nodes, "tls"):
        findings.append(Finding(
            severity="warning",
            title="Tampering: sem criptografia em trânsito documentada",
            detail="Nenhum certificado TLS/HTTPS/mTLS identificado no diagrama. Dados podem ser interceptados.",
            fix_action={"action_type": "add_zone", "label": "Adicionar zona TLS",
                        "payload": {"zoneKind": "security_boundary", "label": "Zona TLS"}},
            model="stride",
        ))

    # === REPUDIATION ===
    # Múltiplos serviços sem audit trail (cap `audit`).
    if len(cards) > AUDIT_MIN_CARDS and not has_cap(cards, "audit"):
        findings.append(Finding(
            severity="warning",
            title=TITLE_STRIDE_REPUDIATION,
            detail="Sistema com múltiplos serviços mas sem logging/audit visível. Não há como repudiar ações maliciosas.",
            fix_action={"action_type": "add_catalog_node", "label": "Adicionar audit log", "payload": {"catalogId": "pat-loki"}},
            model="stride",
        ))

    # === INFORMATION DISCLOSURE ===
    # PII sem criptografia (cap `kms`).
    pii_nodes = [n for n in cards if _node_data(n).get("piiSensitivity") in PII_SENSITIVITIES]
    if pii_nodes and not has_cap(nodes, "kms"):
        for node in pii_nodes[:MAX_PII_NODES]:
            data = _node_data(node)
            sens = data.get("piiSensitivity") or "sensível"
            findings.append(Finding(
                node_id=str(node.get("id")),
                severity="critical",
                title=f"Info Disclosure: PII sem criptografia em dados {sens}",
                detail=f"«{data.get('label')}» armazena PII sensível sem KMS/Vault identificado.",
                fix_action={"action_type": "add_catalog_node", "label": "Adicionar KMS", "payload": {"catalogId": "pat-kms"}},
                model="stride",
            ))

    # === DENIAL OF SERVICE ===
    # API exposta sem WAF/throttling (caps `waf` + `rate_limit`).
    if cards and external_nodes and not has_cap(cards, "waf") and not has_cap(cards, "rate_limit"):
        findings.append(Finding(
            severity="warning",
            title="DoS: sem proteção contra ataques de negação de serviço",
            detail="APIs expostas sem WAF/Rate Limit/Throttling identificados.",
            fix_action={"action_type": "add_catalog_node", "label": "Adicionar WAF", "payload": {"catalogId": "sec-waf"}},
            model="stride",
        ))

    # === ELEVATION OF PRIVILEGE ===
    # Identidade configurada sem política de acesso (cap `iam`).
    if not has_cap(cards, "iam") and has_identity:
        findings.append(Finding(
            severity="info",
            title=TITLE_STRIDE_EOP,
            detail="Identidade configurada mas sem política de acesso (IAM/RBAC) documentada.",
            model="stride",
        ))

    # === LINDDUN-Linkability: muitos fluxos de dados a partir de bancos ===
    data_edges = [
        e for e in edges
        if _node_data(by_id.get(str(e.get("source")), {})).get("kind") == "database"
    ]
    if len(data_edges) > LINKABILITY_DATA_EDGE_THRESHOLD:
        findings.append(Finding(
            severity="info",
            title="LINDDUN-Linkability: muitos fluxos de dados conectam entidades",
            detail="Alta conectividade de dados pode permitir linkability entre entidades separadas.",
            model="linddun",
        ))

    # === LINDDUN-Identifiability: PII trafegando por event bus ===
    if pii_nodes and has_cap(cards, "event_bus"):
        findings.append(Finding(
            severity="warning",
            title="LINDDUN-Identifiability: PII pode vazar via eventos",
            detail="Dados sensíveis transmitidos por filas/eventos sem anonimização identificada.",
            fix_action={"action_type": "note", "label": "Anonimizar eventos",
                        "payload": {"note": "Anonimizar/pseudonimizar PII antes de publicar em filas/eventos"}},
            model="linddun",
        ))

    # === LINDDUN-NonRepudiation: transações sem audit trail ===
    if not has_cap(cards, "audit") and any(_matches(n, *PAYMENT_KEYS) for n in cards):
        findings.append(Finding(
            severity="critical",
            title=TITLE_LINDDUN_NONREP,
            detail="Serviço financeiro sem audit trail = risco de repúdio.",
            model="linddun",
        ))

    return findings


def analyze_linddun(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> list[Finding]:
    """LINDDUN (Detail Exposure, Disclosed Info, Unauthorized Access,
    Non-Compliance). `nfr` alimenta só o check de não-conformidade.
    """
    nfr = nfr or {}
    findings: list[Finding] = []
    cards = _cards(nodes)

    pii_nodes = [n for n in cards if _node_data(n).get("piiSensitivity") in PII_SENSITIVITIES]

    # Detail exposure: PII circulando sem infra de logs/audit para controlá-la.
    if pii_nodes and not has_cap(cards, "audit"):
        findings.append(Finding(
            severity="warning",
            title="LINDDUN-Detail Exposure: PII em logs sem controle",
            detail="Dados sensíveis podem ser logados sem política de masking.",
            fix_action={"action_type": "note", "label": "Mascarar PII em logs",
                        "payload": {"note": "Definir política de masking/retenção para PII em logs"}},
            model="linddun",
        ))

    # Disclosed information: API pública sem masking/anonimização (cap `masking`).
    public_apis = [n for n in cards if has_cap([n], "public_api")]
    if public_apis and not has_cap(cards, "masking"):
        findings.append(Finding(
            severity="warning",
            title="LINDDUN-Disclosed Info: APIs públicas sem masking",
            detail="Dados internos podem vazar via respostas de API.",
            model="linddun",
        ))

    # Unauthorized access: múltiplos serviços sem política de acesso (cap `iam`).
    if not has_cap(cards, "iam") and len(cards) > ACCESS_MIN_CARDS:
        findings.append(Finding(
            severity="info",
            title=TITLE_LINDDUN_UNAUTHORIZED,
            detail="Múltiplos serviços sem política de acesso identificada.",
            model="linddun",
        ))

    # Non-compliance: NFR exige compliance e nenhum componente endereça.
    compliance = nfr.get("compliance", [])
    if compliance and not has_cap(cards, "compliance"):
        findings.append(Finding(
            severity="critical",
            title="LINDDUN-Non-Compliance: requisitos de compliance não endereçados",
            detail=f"Compliance solicitado: {', '.join(compliance)}. Nenhum componente de conformidade no diagrama.",
            model="linddun",
        ))

    return findings


def _dedup_cross_model(
    stride_findings: list[Finding],
    linddun_findings: list[Finding],
) -> list[Finding]:
    """Causa-raiz comum entre modelos: o mais específico/crítico vence.

    - LINDDUN-NonRepudiation (critical) → corta STRIDE-Repudiation (warning):
      ambos nascem da ausência de audit trail; o critical se mantém.
    - LINDDUN-Unauthorized Access → corta STRIDE-EoP: o LINDDUN é o mais
      genérico sobre "sem controle de acesso granular".

    Os checks de dados LINDDUN (Linkability/Identifiability/NonRepudiation)
    vivem em `analyze_stride` (herança da estrutura original), então a
    dedup considera o conjunto de títulos dos DOIS lados.
    """
    fired_titles = {f.title for f in stride_findings + linddun_findings}
    kept: list[Finding] = []
    for f in stride_findings:
        if f.title == TITLE_STRIDE_REPUDIATION and TITLE_LINDDUN_NONREP in fired_titles:
            continue
        if f.title == TITLE_STRIDE_EOP and TITLE_LINDDUN_UNAUTHORIZED in fired_titles:
            continue
        kept.append(f)
    return kept + linddun_findings


def enrich_threat_analysis(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> list[Finding]:
    """Executa STRIDE + LINDDUN e aplica a dedup cross-model.

    Contrato fixo para a rota de threat (GET/POST live): devolve APENAS os
    findings heurísticos, cada um com `model` ("stride" | "linddun").
    """
    stride_findings = analyze_stride(nodes, edges)
    linddun_findings = analyze_linddun(nodes, edges, nfr)
    return _dedup_cross_model(stride_findings, linddun_findings)
