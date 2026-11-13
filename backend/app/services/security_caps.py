"""Controles de segurança por item de catálogo (R4 do PLAN de threat).

Mapeia cada `catalogId` relevante → capacidades de segurança (override
curado, NUNCA exclusivo). A curadoria é feita contra os ids REAIS dos
catálogos do front (web/src/lib/catalog.ts, catalog-multicloud.ts,
catalog-network.ts, catalog-patterns.ts; espelho em
`app/services/catalog_snapshot.json` — verificação dos ids travada por
`tests/test_threat_service.py`).

Regras de consumo (`has_cap(nodes, cap)`), por nó:

1. `catalogId` está em `SECURITY_CAPS` → as capacidades do nó são o
   conjunto do mapa (fonte da verdade: o catálogo decide).
2. `catalogId` `pat-*` FORA do mapa → NENHUMA capacidade. Padrões de
   arquitetura não são controles de segurança (foi a fonte do FP antigo
   "pat-event-driven" casando com a chave nua "event").
3. Demais casos (nó custom sem `catalogId`, ou `catalogId` de catálogo
   fora do mapa) → fallback por substring no blob `label + tech`
   (lowercased) usando `LABEL_TECH_FALLBACK[cap]`. O `catalogId` SAI do
   blob: só `label` e `tech` entram.

Caps disponíveis: `CAPS` (tls, waf, rate_limit, audit, iam, identity,
kms, event_bus, masking, compliance, public_api).

Como adicionar uma entrada nova:
1. Descubra o id real em `web/src/lib/catalog*.ts` (não invente: o teste
   de snapshot trava que todo id do mapa exista).
2. Atribua as caps que o item realmente fornece (item pode ter várias:
   ex. API Gateway → tls + rate_limit + public_api).
3. Se for um `pat-*`, a inclusão no mapa é o que o faz contar como
   controle (fora do mapa, padrão nenhum cap dá).
4. Fixe o comportamento com um teste em `tests/test_threat_service.py`
   (nó que silencia o check correspondente).
"""

from __future__ import annotations

from typing import Any

# Prefixo dos padrões de arquitetura (catalog-patterns.ts).
PATTERN_ID_PREFIX = "pat-"

CAPS = (
    "tls",
    "waf",
    "rate_limit",
    "audit",
    "iam",
    "identity",
    "kms",
    "event_bus",
    "masking",
    "compliance",
    "public_api",
)

SECURITY_CAPS: dict[str, set[str]] = {
    # ── TLS em trânsito (terminação implícita / certificação) ──────────
    "cloud-aws-cf": {"tls"},
    "dep-cloudfront": {"tls"},
    "cloud-aws-alb": {"tls"},
    "cloud-aws-apigw": {"tls", "rate_limit", "public_api"},
    "mc-azure-frontdoor": {"tls", "waf"},
    "mc-gcp-armor": {"tls", "waf"},
    "mc-azure-apim": {"tls", "rate_limit", "public_api"},
    "mc-gcp-apigw": {"tls", "rate_limit", "public_api"},
    "sec-certs": {"tls"},
    "sec-mtls": {"tls"},
    "sec-encryption": {"tls", "kms"},
    "pat-mtls": {"tls"},
    # ── WAF / DDoS ──────────────────────────────────────────────────────
    "sec-waf": {"waf"},
    "sec-ddos": {"waf"},
    "mc-aws-waf": {"waf"},
    # ── Rate limiting / throttling ─────────────────────────────────────
    "pat-rate-limit": {"rate_limit"},
    # ── Observabilidade = audit trail (logs/métricas/traços) ───────────
    "pat-loki": {"audit"},
    "pat-prometheus": {"audit"},
    "pat-grafana": {"audit"},
    "pat-distributed-trace": {"audit"},
    "obs-loki": {"audit"},
    "obs-prometheus": {"audit"},
    "obs-grafana": {"audit"},
    "obs-cloudwatch": {"audit"},
    "obs-datadog": {"audit"},
    "obs-otel": {"audit"},
    "obs-jaeger": {"audit"},
    "mc-aws-cloudwatch": {"audit"},
    "mc-azure-monitor": {"audit"},
    "mc-gcp-monitoring": {"audit"},
    # ── IAM (política de acesso) ────────────────────────────────────────
    "sec-iam-role": {"iam"},
    "sec-iam-policy": {"iam"},
    # ── Identidade (authn) ─────────────────────────────────────────────
    "pat-oidc": {"identity"},
    "sec-oidc": {"identity"},
    "id-cognito": {"identity"},
    "id-auth0": {"identity"},
    "id-keycloak": {"identity"},
    "id-jwt": {"identity"},
    "id-firebase": {"identity"},
    "id-supabase-auth": {"identity"},
    "id-clerk": {"identity"},
    "id-ory": {"identity"},
    "mc-azure-entra": {"identity"},
    "mc-gcp-identity": {"identity"},
    "mc-aws-lambda-auth": {"identity"},
    # ── KMS / segredos / criptografia ──────────────────────────────────
    "pat-kms": {"kms"},
    "pat-vault": {"kms"},
    "sec-kms-key": {"kms"},
    "sec-secrets": {"kms"},
    "mc-aws-secrets": {"kms"},
    "mc-azure-keyvault": {"kms"},
    "mc-gcp-secret": {"kms"},
    # ── Event bus / streaming ──────────────────────────────────────────
    "int-kafka": {"event_bus"},
    "int-sqs": {"event_bus"},
    "int-sns": {"event_bus"},
    "int-rabbit": {"event_bus"},
    "int-nats": {"event_bus"},
    "int-pulsar": {"event_bus"},
    "int-redis-streams": {"event_bus"},
    "int-redis-pubsub": {"event_bus"},
    "mc-azure-eventhubs": {"event_bus"},
    "mc-azure-servicebus": {"event_bus"},
    "mc-gcp-pubsub": {"event_bus"},
    # ── Compliance ─────────────────────────────────────────────────────
    "sec-config": {"compliance", "audit"},
    # "masking": sem item dedicado nos catálogos hoje — a cap existe só
    # via fallback label+tech (nó custom "Data Masking" etc.).
}

# Fallback substring para nós FORA do mapa (regra 3 acima). Só o blob
# `label + tech` (lowercased) é consultado — nunca o `catalogId`.
LABEL_TECH_FALLBACK: dict[str, tuple[str, ...]] = {
    "tls": ("tls", "https", "ssl", "cert", "mtls"),
    "waf": ("waf", "ddos", "rate limit", "throttl"),
    "rate_limit": ("rate limit", "throttl", "limiter"),
    "audit": ("audit", "log", "immutable", "ledger", "cloudwatch", "splunk", "datadog"),
    "iam": ("iam", "role", "rbac", "acl", "permission"),
    "identity": ("oidc", "oauth", "auth0", "keycloak", "identity", "cognito", "auth"),
    "kms": ("kms", "vault", "encrypt", "secret", "cmk"),
    "event_bus": ("kafka", "pubsub", "sqs", "sns", "eventbridge", "stream"),
    "masking": ("mask", "anonym", "pseudonym", "tokenize"),
    "compliance": ("compliance", "gdpr", "lgpd", "hipaa", "pci", "iso"),
    "public_api": ("public", "rest", "graphql"),
}


def _node_blob(node: dict[str, Any]) -> str:
    """Blob `label + tech` (lowercased) de um nó — `catalogId` fora."""
    data = node.get("data")
    if not isinstance(data, dict):
        return ""
    label = str(data.get("label") or "")
    tech = str(data.get("tech") or "")
    return f"{label} {tech}".lower()


def _node_has_cap(node: dict[str, Any], cap: str) -> bool:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    catalog_id = str(data.get("catalogId") or "")
    if catalog_id in SECURITY_CAPS:
        # Mapa é a fonte da verdade para o nó.
        return cap in SECURITY_CAPS[catalog_id]
    if catalog_id.startswith(PATTERN_ID_PREFIX):
        # Padrão fora do mapa não contribui nenhuma cap (regra 2).
        return False
    return any(key in _node_blob(node) for key in LABEL_TECH_FALLBACK.get(cap, ()))


def has_cap(nodes: list[dict[str, Any]], cap: str) -> bool:
    """True se QUALQUER nó do grafo fornece `cap` (mapa + fallback)."""
    if cap not in CAPS:
        raise ValueError(f"capability desconhecida: {cap!r} (válidas: {', '.join(CAPS)})")
    return any(_node_has_cap(n, cap) for n in nodes if isinstance(n, dict))
