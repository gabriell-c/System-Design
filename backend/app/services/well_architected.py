"""P1.2.7 — Well-Architected review scorecard for AWS/Azure/GCP."""

from __future__ import annotations

from typing import Any

from app.schemas.analysis import ReviewScorecard


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


def _blob(n: dict) -> str:
    d = _node_data(n)
    return f"{d.get('label', '')} {d.get('tech', '')} {d.get('catalogId', '')}".lower()


def _matches(n: dict, *keys: str) -> bool:
    return any(k in _blob(n) for k in keys)


def _count_nodes(nodes: list[dict], kind_filter: str | None = None, keyword_filter: tuple[str, ...] = ()) -> int:
    count = 0
    for n in nodes:
        d = _node_data(n)
        if kind_filter and d.get("kind") != kind_filter:
            continue
        if keyword_filter and not any(k in _blob(n) for k in keyword_filter):
            continue
        count += 1
    return count


def calculate_well_architected_score(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> ReviewScorecard:
    """Calculate Well-Architected Framework score across 6 pillars."""
    nfr = nfr or {}

    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block"}]
    zones = [n for n in nodes if _node_data(n).get("kind") == "zone"]

    # === 1. Operational Excellence ===
    op_score = 0.0
    op_count = 0
    # IaC
    if _count_nodes(cards, keyword_filter=("terraform", "cloudformation", "pulumi", "cdk", "ansible")) > 0:
        op_score += 2
    op_count += 2
    # CI/CD
    if _count_nodes(cards, keyword_filter=("ci/cd", "jenkins", "github actions", "gitlab", "argocd", "tekton")) > 0:
        op_score += 2
    op_count += 2
    # Runbooks
    if nfr.get("runbooks"):
        op_score += 1
    op_count += 1
    # Change management
    if nfr.get("change_management"):
        op_score += 1
    op_count += 1
    operational_excellence = (op_score / op_count * 10) if op_count else 0

    # === 2. Security ===
    sec_score = 0.0
    sec_count = 0
    # Encryption at rest
    if _count_nodes(cards, keyword_filter=("kms", "vault", "encrypt", "aes")) > 0:
        sec_score += 2
    sec_count += 2
    # Encryption in transit
    if _count_nodes(cards, keyword_filter=("tls", "https", "ssl", "mtls")) > 0:
        sec_score += 2
    sec_count += 2
    # Identity
    if _count_nodes(cards, keyword_filter=("oidc", "oauth", "iam", "keycloak", "cognito", "auth0")) > 0:
        sec_score += 2
    sec_count += 2
    # Network security
    if _count_nodes(cards, keyword_filter=("waf", "security group", "sg", "network acl")) > 0:
        sec_score += 2
    sec_count += 2
    # Secret management
    if _count_nodes(cards, keyword_filter=("secrets manager", "vault", "ssm")) > 0:
        sec_score += 2
    sec_count += 2
    security = (sec_score / sec_count * 10) if sec_count else 0

    # === 3. Reliability ===
    rel_score = 0.0
    rel_count = 0
    # Multi-AZ / HA
    az_zones = [z for z in zones if _node_data(z).get("zoneKind") == "availability_zone"]
    if len(az_zones) >= 2:
        rel_score += 3
    rel_count += 3
    # Auto-scaling
    if _count_nodes(cards, keyword_filter=("autoscaling", "keda", "hpa", "scale")) > 0:
        rel_score += 2
    rel_count += 2
    # Circuit breaker
    if _count_nodes(cards, keyword_filter=("breaker", "circuit", "hystrix", "resilience4j")) > 0:
        rel_score += 2
    rel_count += 2
    # Retry/fallback
    if any(e.get("data", {}).get("failureBehavior") in {"retry", "fallback"} for e in edges):
        rel_score += 2
    rel_count += 2
    # Backup/restore
    if nfr.get("backup_strategy"):
        rel_score += 1
    rel_count += 1
    reliability = (rel_score / rel_count * 10) if rel_count else 0

    # === 4. Performance Efficiency ===
    perf_score = 0.0
    perf_count = 0
    # Caching
    if _count_nodes(cards, keyword_filter=("redis", "memcached", "varnish", "cdn", "cloudfront")) > 0:
        perf_score += 2
    perf_count += 2
    # Database optimization
    if _count_nodes(cards, keyword_filter=("read replica", "caching", "materialized view")) > 0:
        perf_score += 2
    perf_count += 2
    # Async processing
    if _count_nodes(cards, keyword_filter=("kafka", "rabbitmq", "sqs", "nsq", "pulsar")) > 0:
        perf_score += 2
    perf_count += 2
    # Load balancing
    if _count_nodes(cards, keyword_filter=("alb", "nlb", "nginx", "traefik", "envoy")) > 0:
        perf_score += 2
    perf_count += 2
    performance_efficiency = (perf_score / perf_count * 10) if perf_count else 0

    # === 5. Cost Optimization ===
    cost_score = 0.0
    cost_count = 0
    # Right-sizing
    if nfr.get("right_sizing"):
        cost_score += 2
    cost_count += 2
    # Reserved instances / savings plans
    if nfr.get("reserved_instances"):
        cost_score += 2
    cost_count += 2
    # Serverless (usually more cost-efficient)
    serverless_count = _count_nodes(cards, keyword_filter=("lambda", "cloud run", "functions", "serverless"))
    if serverless_count > 0:
        cost_score += 1
    cost_count += 1
    # Tagging
    if nfr.get("tagging_policy"):
        cost_score += 1
    cost_count += 1
    cost_optimization = (cost_score / cost_count * 10) if cost_count else 0

    # === 6. Sustainability ===
    sustain_score = 0.0
    sustain_count = 0
    # Region efficiency
    if _count_nodes(cards, keyword_filter=("green", "carbon", "renewable")) > 0:
        sustain_score += 2
    sustain_count += 2
    # Resource efficiency
    if nfr.get("resource_efficiency"):
        sustain_score += 2
    sustain_count += 2
    # Dead resource cleanup
    if nfr.get("cleanup_policy"):
        sustain_score += 1
    sustain_count += 1
    sustainability = (sustain_score / sustain_count * 10) if sustain_count else 0

    overall = (
        operational_excellence + security + reliability
        + performance_efficiency + cost_optimization + sustainability
    ) / 6

    gaps: list[str] = []
    if security < 6:
        gaps.append("Security: improve encryption, identity, and secret management")
    if reliability < 6:
        gaps.append("Reliability: add multi-AZ, auto-scaling, circuit breakers")
    if performance_efficiency < 6:
        gaps.append("Performance: add caching, async processing, load balancing")
    if cost_optimization < 6:
        gaps.append("Cost: implement reserved instances and right-sizing")
    if sustainability < 6:
        gaps.append("Sustainability: track carbon footprint and resource efficiency")
    if operational_excellence < 6:
        gaps.append("Operational excellence: add IaC, CI/CD, and runbooks")

    review_ready = overall >= 7.0 and len(gaps) <= 2

    return ReviewScorecard(
        narrative=operational_excellence,
        views_completeness=security,
        placement=reliability,
        flow_continuity=performance_efficiency,
        operability=cost_optimization,
        decision_quality=sustainability,
        overall=round(overall, 1),
        review_ready=review_ready,
        gaps=gaps,
    )
