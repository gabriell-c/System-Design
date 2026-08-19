"""Heurísticas de arquitetura (estilo, coesão, acoplamento, coerência)."""

from __future__ import annotations

from typing import Any

from app.schemas.arch_style import (
    ArchStyle,
    CohesionCoupling,
    DomainCoherenceScore,
    ReviewScorecard,
    TradeOffEntry,
)
from app.schemas.graph import ProjectNfr

# Mapeamento de keywords → probabilidade de estilo
ARCH_STYLE_KEYWORDS: dict[str, float] = {
    # Monolítico
    "monolithic": 0.9,
    "monolith": 0.9,
    # Camadas
    "layered": 0.8,
    "layer": 0.8,
    # Microsserviços
    "microservice": 0.9,
    # Event-driven
    "event_driven": 0.9,
    "event-driven": 0.9,
    "kafka": 0.7,
    "rabbitmq": 0.6,
    # Hexagonal
    "hexagonal": 0.9,
    "hexagon": 0.9,
    "ports": 0.7,
    "adapters": 0.7,
    "clean_architecture": 0.8,
    # Serverless
    "serverless": 0.9,
    "lambda": 0.7,
    "fargate": 0.5,
    # SOA
    "soa": 0.9,
    "soap": 0.7,
    "enterprise": 0.5,
}

# Recomendações baseadas em team_size + users_per_day + deadline_weeks
STYLE_RECOMMENDATIONS: dict[str, dict] = {
    "monolithic": {
        "min_team": 1,
        "max_team": 3,
        "min_users": None,
        "max_users": 2000,
        "min_deadline": None,
        "max_deadline": 8,
    },
    "layered": {
        "min_team": 2,
        "max_team": 6,
        "min_users": 500,
        "max_users": 10000,
        "min_deadline": None,
        "max_deadline": 20,
    },
    "microservices": {
        "min_team": 4,
        "max_team": None,
        "min_users": 5000,
        "max_users": None,
        "min_deadline": None,
        "max_deadline": None,
    },
    "event_driven": {
        "min_team": 4,
        "max_team": None,
        "min_users": 10000,
        "max_users": None,
        "min_deadline": None,
        "max_deadline": None,
    },
    "hexagonal": {
        "min_team": 3,
        "max_team": 8,
        "min_users": None,
        "max_users": 5000,
        "min_deadline": None,
        "max_deadline": 24,
    },
    "serverless": {
        "min_team": 1,
        "max_team": 4,
        "min_users": None,
        "max_users": 2000,
        "min_deadline": None,
        "max_deadline": 6,
    },
    "soa": {
        "min_team": 5,
        "max_team": None,
        "min_users": 10000,
        "max_users": None,
        "min_deadline": None,
        "max_deadline": None,
    },
}


def classify_architecture_style(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
) -> tuple[str, float]:
    """
    Classifica o estilo arquitetural baseado em:
    - keywords nos nós (tech, label, config)
    - team_size, users_per_day, deadline_weeks do NFR
    """
    nfr = nfr or ProjectNfr()
    team_size = nfr.team_size or 1
    users = nfr.users_per_day or 0
    deadline = nfr.deadline_weeks or 12

    # Coletar todas as palavras-chave dos nós
    keywords: list[str] = []
    for node in nodes:
        data = node.get("data") or {}
        config = data.get("config") or {}
        # Adicionar tech, label e valores de config
        keywords.append(data.get("tech", "").lower())
        keywords.append(data.get("label", "").lower())
        for v in config.values():
            if isinstance(v, str):
                keywords.append(v.lower())
        # Adicionar kind
        if kind := data.get("kind"):
            keywords.append(kind.lower())

    # Calcular scores para cada estilo
    scores: dict[str, float] = {}
    for style in ArchStyle.__args__:  # type: ignore
        score = 0.0
        for kw, weight in ARCH_STYLE_KEYWORDS.items():
            if kw in " ".join(keywords):
                score += weight
        scores[style] = score

    # Recomendação baseada em NFRs
    recommendations: dict[str, float] = {}
    for style, params in STYLE_RECOMMENDATIONS.items():
        s = 0.0
        # Check team_size
        if params["min_team"] and team_size < params["min_team"]:
            s -= 0.3
        if params["max_team"] and team_size > params["max_team"]:
            s -= 0.3
        # Check users
        if params["min_users"] and users < params["min_users"]:
            s -= 0.2
        if params["max_users"] and users > params["max_users"]:
            s -= 0.2
        # Check deadline
        if params["min_deadline"] and deadline < params["min_deadline"]:
            s -= 0.2
        if params["max_deadline"] and deadline > params["max_deadline"]:
            s -= 0.2
        recommendations[style] = s

    # Combinar scores
    final_scores: dict[str, float] = {}
    for style in ArchStyle.__args__:  # type: ignore
        final_scores[style] = scores.get(style, 0.0) + recommendations.get(style, 0.0)

    # Escolher estilo com maior score
    if not final_scores:
        return "monolithic", 0.5
    best_style = max(final_scores, key=final_scores.get)
    confidence = final_scores[best_style] / max(sum(final_scores.values()), 1.0)
    confidence = min(1.0, max(0.0, confidence))

    return best_style, round(confidence, 2)


def compute_cohesion_coupling(
    nodes: list[dict],
    edges: list[dict],
) -> CohesionCoupling:
    """
    Calcula métricas de coesão e acoplamento entre domínios.
    - Coesão: quão relacionados estão os componentes dentro de um domínio
    - Acoplamento: quão dependentes são os domínios entre si
    """
    # Agrupar nós por domínio
    by_kind: dict[str, list[dict]] = {}
    for node in nodes:
        data = node.get("data") or {}
        kind = data.get("kind", "unknown")
        if kind not in by_kind:
            by_kind[kind] = []
        by_kind[kind].append(node)

    # Calcular coesão por domínio (baseado em edges internas)
    cohesion: dict[str, float] = {}
    for kind, kind_nodes in by_kind.items():
        if not kind_nodes:
            cohesion[kind] = 0.0
            continue
        # Contar edges que conectam nós do mesmo domínio
        internal_edges = 0
        for edge in edges:
            src = edge.get("source")
            tgt = edge.get("target")
            src_data = next((n.get("data") for n in nodes if n.get("id") == src), {})
            tgt_data = next((n.get("data") for n in nodes if n.get("id") == tgt), {})
            if src_data.get("kind") == kind and tgt_data.get("kind") == kind:
                internal_edges += 1
        # Coesão = edges internas / total possível
        n = len(kind_nodes)
        max_edges = n * (n - 1) / 2 if n > 1 else 1
        cohesion[kind] = min(10.0, (internal_edges / max(max_edges, 1)) * 10)

    # Calcular acoplamento (edges entre domínios diferentes)
    total_edges = len(edges)
    cross_domain_edges = 0
    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")
        src_data = next((n.get("data") for n in nodes if n.get("id") == src), {})
        tgt_data = next((n.get("data") for n in nodes if n.get("id") == tgt), {})
        if src_data.get("kind") != tgt_data.get("kind"):
            cross_domain_edges += 1

    coupling = (cross_domain_edges / max(total_edges, 1)) * 10

    # Coesão geral = média das coesões por domínio
    cohesion_values = [v for v in cohesion.values() if v > 0]
    avg_cohesion = sum(cohesion_values) / len(cohesion_values) if cohesion_values else 5.0

    return CohesionCoupling(
        cohesion_score=round(avg_cohesion, 2),
        coupling_score=round(coupling, 2),
        por_dominio={k: round(v, 2) for k, v in cohesion.items()},
    )


def check_domain_coherence(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
) -> DomainCoherenceScore:
    """
    Verifica coerência entre domínios (AN/AD/AA/AI).
    - AN: processos de negócio
    - AD: entidades de dados
    - AA: sistemas/aplicações
    - AI: infraestrutura
    """
    nfr = nfr or ProjectNfr()

    # Verificar AN → AA (processos de negócio têm suporte em sistemas)
    an_aa_score = 10.0
    if nfr.business_processes:
        # Verificar se há algum backend/cadastro
        has_backend = any(
            (node.get("data") or {}).get("kind") == "backend"
            for node in nodes
        )
        if not has_backend:
            an_aa_score -= 5.0
        if len(nodes) < len(nfr.business_processes) * 2:
            an_aa_score -= 2.0

    # Verificar AD → AA (entidades de dados têm suporte em DBs)
    ad_aa_score = 10.0
    if nfr.data_entities:
        has_database = any(
            (node.get("data") or {}).get("kind") == "database"
            for node in nodes
        )
        if not has_database:
            ad_aa_score -= 5.0
        # Verificar se há mais entidades que nós de banco
        db_nodes = [n for n in nodes if (n.get("data") or {}).get("kind") == "database"]
        if len(nfr.data_entities) > len(db_nodes) * 2:
            ad_aa_score -= 3.0

    # Verificar AD → AI (governança tem suporte em infra)
    ai_score = 10.0
    if nfr.data_governance:
        has_observability = any(
            (node.get("data") or {}).get("kind") == "observability"
            for node in nodes
        )
        has_identity = any(
            (node.get("data") or {}).get("kind") == "identity"
            for node in nodes
        )
        if not has_observability:
            ai_score -= 2.0
        if not has_identity:
            ai_score -= 2.0

    # Coerência geral
    geral = (an_aa_score + ad_aa_score + ai_score) / 3

    return DomainCoherenceScore(
        an=round(an_aa_score, 2),
        ad=round(ad_aa_score, 2),
        aa=round((an_aa_score + ad_aa_score) / 2, 2),
        ai=round(ai_score, 2),
        geral=round(geral, 2),
    )


def suggest_trade_offs(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
) -> list[TradeOffEntry]:
    """
    Gera trade-offs arquiteturais documentados com base no grafo e NFRs.
    """
    nfr = nfr or ProjectNfr()
    trade_offs: list[TradeOffEntry] = []

    # Trade-off 1: Escalabilidade vs Complexidade
    has_micro = any(
        "micro" in (node.get("data") or {}).get("label", "").lower()
        or "service" in (node.get("data") or {}).get("label", "").lower()
        for node in nodes
    )
    if has_micro:
        trade_offs.append(TradeOffEntry(
            decisao="Adotar microsserviços",
            alternativa_rejeitada="Monolito",
            vantagem="Escalabilidade granular, times autônomos",
            desvantagem="Complexidade operacional alta",
            criterio_escolha=f"Time de {nfr.team_size} devs, {nfr.users_per_day or 0} usuários/dia",
        ))

    # Trade-off 2: Consistência vs Disponibilidade
    has_sql = any(
        "postgres" in (node.get("data") or {}).get("label", "").lower()
        or "mysql" in (node.get("data") or {}).get("label", "").lower()
        or "sql" in (node.get("data") or {}).get("label", "").lower()
        for node in nodes
    )
    has_nosql = any(
        "mongo" in (node.get("data") or {}).get("label", "").lower()
        or "dynamo" in (node.get("data") or {}).get("label", "").lower()
        or "cassandra" in (node.get("data") or {}).get("label", "").lower()
        for node in nodes
    )
    if has_sql and has_nosql:
        trade_offs.append(TradeOffEntry(
            decisao="Usar SQL + NoSQL",
            alternativa_rejeitada="Escolher apenas um tipo",
            vantagem="SQL para transações, NoSQL para escala",
            desvantagem="Dual-write, complexidade de consistência",
            criterio_escolha="Dados transacionais + dados de alta escala",
        ))

    # Trade-off 3: On-premise vs Cloud
    has_cloud = any(
        "cloud" in (node.get("data") or {}).get("kind", "").lower()
        or "aws" in (node.get("data") or {}).get("label", "").lower()
        or "azure" in (node.get("data") or {}).get("label", "").lower()
        for node in nodes
    )
    if not has_cloud:
        trade_offs.append(TradeOffEntry(
            decisao="Sem cloud nativo",
            alternativa_rejeitada="Cloud (AWS/Azure/GCP)",
            vantagem="Controle total, custo previsível",
            desvantagem="Escalabilidade limitada, ops manual",
            criterio_escolha=f"Budget US${nfr.budget_usd_month}/mês, sem compliance cloud",
        ))

    return trade_offs


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


def analyze_zone_structure(nodes: list[dict], edges: list[dict]) -> list[Any]:
    """Riscos estruturais de zonas/fluxos. Retorna lista de Finding."""
    from app.schemas.analysis import Finding

    findings: list[Finding] = []
    zones = [n for n in nodes if _node_data(n).get("kind") == "zone"]
    zone_kinds = {_node_data(z).get("zoneKind") for z in zones}
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]

    has_security = "security_boundary" in zone_kinds
    has_private = "subnet_private" in zone_kinds
    has_vpc = "vpc" in zone_kinds
    has_az = "availability_zone" in zone_kinds

    def _label_blob(n: dict) -> str:
        d = _node_data(n)
        return " ".join(
            [
                str(d.get("label") or ""),
                str(d.get("tech") or ""),
                str(d.get("catalogId") or ""),
                str((d.get("config") or {}).get("service") or ""),
                str((d.get("config") or {}).get("capability") or ""),
            ]
        ).lower()

    has_auth = any(
        any(k in _label_blob(n) for k in ("auth", "cognito", "authorizer", "entra", "identity", "jwt"))
        for n in cards
    )
    has_edge_api = any(
        any(k in _label_blob(n) for k in ("api gateway", "apigw", "apim", "front door", "cloudfront", "waf"))
        for n in cards
    )
    has_compute = any(
        any(k in _label_blob(n) for k in ("lambda", "ecs", "functions", "cloud run", "fargate", "ec2"))
        for n in cards
    )

    if zones and has_compute and has_edge_api and not has_auth and not has_security:
        findings.append(
            Finding(
                severity="warning",
                title="Compute na borda sem AuthZ explícita",
                detail=(
                    "Há API/edge e compute, mas não há security boundary nem serviço de auth/authorizer. "
                    "Nos padrões analisados, authorize vem antes do backend."
                ),
            )
        )

    if has_vpc and not has_private and has_compute:
        findings.append(
            Finding(
                severity="warning",
                title="VPC sem subnet privada",
                detail="Há VPC e compute, mas nenhuma subnet_private. Workloads sensíveis deveriam ficar em subnet privada.",
            )
        )

    for n in cards:
        blob = _label_blob(n)
        is_data = _node_data(n).get("kind") == "database" or any(
            k in blob for k in ("postgres", "mysql", "dynamo", "cosmos", "rds", "firestore", "sql")
        )
        if not is_data:
            continue
        parent_id = n.get("parentId")
        parent = next((z for z in zones if z.get("id") == parent_id), None)
        if parent and _node_data(parent).get("zoneKind") == "subnet_public":
            findings.append(
                Finding(
                    node_id=str(n.get("id")),
                    severity="critical",
                    title="Dado em subnet pública",
                    detail=(
                        f"{_node_data(n).get('label')} está aninhado em subnet pública — "
                        "risco de exposição. Prefira subnet_private."
                    ),
                )
            )

    az_count = sum(1 for z in zones if _node_data(z).get("zoneKind") == "availability_zone")
    if has_az and az_count < 2:
        findings.append(
            Finding(
                severity="info",
                title="Uma única AZ",
                detail="Há Availability Zone, mas só uma. Multi-AZ tipicamente usa pelo menos duas para HA.",
            )
        )

    async_edges = sum(1 for e in edges if (e.get("data") or {}).get("flowKind") in {"async", "data"})
    if len(edges) >= 3 and async_edges == 0 and any(
        "event" in _label_blob(n) or "queue" in _label_blob(n) or "hub" in _label_blob(n) for n in cards
    ):
        findings.append(
            Finding(
                severity="info",
                title="Filas/eventos sem fluxo async tipado",
                detail=(
                    "Há componentes de messaging, mas nenhuma aresta com flowKind async/data. "
                    "Tipar fluxos melhora a leitura da arquitetura."
                ),
            )
        )

    if zones and not has_vpc and has_compute:
        findings.append(
            Finding(
                severity="info",
                title="Compute sem VPC/VNet",
                detail="Há zonas e compute, mas sem VPC. Em clouds públicas, isole workloads em rede privada quando possível.",
            )
        )

    # Validate firewall rules on edges crossing zone boundaries
    zone_map = {n.get("id"): _node_data(n) for n in zones}

    def _parent_zone(node_id: str) -> dict | None:
        """Find the nearest parent zone for a node."""
        for n in nodes:
            if n.get("id") == node_id:
                parent_id = n.get("parentId")
                if parent_id and parent_id in zone_map:
                    return zone_map[parent_id]
        return None

    for edge in edges:
        edge_data = edge.get("data") or {}
        firewall_rules = edge_data.get("firewallRules") or []
        src_id = edge.get("source")
        tgt_id = edge.get("target")

        src_zone = _parent_zone(src_id)
        tgt_zone = _parent_zone(tgt_id)
        if not src_zone or not tgt_zone:
            continue

        src_kind = src_zone.get("zoneKind")
        tgt_kind = tgt_zone.get("zoneKind")
        if src_kind == tgt_kind:
            continue

        # Check edges from public to private zones without firewall rules
        public_private_cross = (src_kind == "subnet_public" and tgt_kind == "subnet_private") or \
                               (src_kind == "subnet_private" and tgt_kind == "subnet_public")
        if public_private_cross and not firewall_rules:
            findings.append(
                Finding(
                    severity="warning",
                    title="Aresta sem Security Group entre zonas",
                    detail=(
                        f"Aresta de '{src_kind}' para '{tgt_kind}' não possui regras de firewall. "
                        "Adicione firewallRules para controle de acesso entre sub-redes."
                    ),
                )
            )

    return findings


def detect_bottlenecks(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
) -> list[Any]:
    """Detecta gargalos de capacidade e marca o card culpado (Finding.node_id).

    Regras (anti-falso-positivo):
    1. Compute overload — users > 100k + 1 compute; ALB presente → warning
    2. DB único HA — avail >= 99.9% + 1 DB + sem multi-AZ
    3. Sem Redis — latency < 200 + users > 50k + sem Redis → backend
    4. Sem fila — users > 100k + sem Kafka/SQS/Rabbit; skip se serverless
    5. Sem LB — > 2 backends + sem ALB/APIGW
    6. S3 sem CDN — users > 50k + S3 sem CDN
    """
    from app.schemas.analysis import Finding

    nfr = nfr or ProjectNfr()
    users = int(nfr.users_per_day or 0)
    avail = float(nfr.availability_pct or nfr.slo_availability_pct or 0)
    latency = nfr.latency_p99_ms if nfr.latency_p99_ms is not None else nfr.slo_latency_p99_ms
    latency_ms = int(latency) if latency is not None else None

    findings: list[Finding] = []
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]
    zones = [n for n in nodes if _node_data(n).get("kind") == "zone"]
    has_multi_az = (
        sum(1 for z in zones if _node_data(z).get("zoneKind") == "availability_zone") >= 2
    )

    def blob(n: dict) -> str:
        return _card_blob(n)

    def matches(n: dict, *keys: str) -> bool:
        b = blob(n)
        return any(k in b for k in keys)

    compute_explicit = [
        n
        for n in cards
        if matches(n, "ecs", "lambda", "ec2", "fargate", "functions", "cloud run", "container apps")
    ]
    compute_cards = compute_explicit or [
        n for n in cards if _node_data(n).get("kind") == "backend"
    ]

    db_cards = [
        n
        for n in cards
        if _node_data(n).get("kind") == "database"
        or matches(n, "postgres", "mysql", "rds", "dynamo", "cosmos", "mongo", "sql", "firestore")
    ]
    redis_cards = [n for n in cards if matches(n, "redis", "elasticache")]
    queue_cards = [
        n
        for n in cards
        if matches(n, "kafka", "sqs", "rabbit", "nats", "sns", "pubsub", "event hub", "service bus", "pulsar")
    ]
    lb_cards = [
        n
        for n in cards
        if matches(n, "alb", "nlb", "apigw", "api gateway", "apim", "load balancer", "front door")
    ]
    cdn_cards = [
        n
        for n in cards
        if matches(n, "cloudfront", "cdn", "cloudflare", "front door", "fastly", "akamai")
    ]
    s3_cards = [n for n in cards if matches(n, "s3", "blob", "gcs", "object storage")]
    backend_cards = [n for n in cards if _node_data(n).get("kind") == "backend"]
    lambda_count = sum(1 for n in cards if matches(n, "lambda", "functions", "cloud run"))
    is_serverless = lambda_count >= 2 or (
        nfr.arch_style == "serverless" if nfr.arch_style else False
    )

    # P1.2.2 — Anti-FP: monolith pequeno / MVP não dispara regras de escala enterprise
    arch_style = nfr.arch_style or ""
    if users < 5_000 and arch_style in {"monolithic", "layered", ""}:
        return findings
    if users < 20_000 and arch_style == "monolithic" and len(backend_cards) <= 2:
        # Skip queue/LB rules for tiny monoliths
        users_threshold_scale = True
    else:
        users_threshold_scale = False

    # 1. Compute overload
    if users > 100_000 and len(compute_cards) == 1:
        node = compute_cards[0]
        sev = "warning" if lb_cards else "critical"
        findings.append(
            Finding(
                node_id=str(node.get("id")),
                severity=sev,
                title="Compute sobrecarregado para a escala",
                detail=(
                    f"{_node_data(node).get('label')} é o único compute com ~{users:,} users/dia. "
                    + (
                        "Há LB, mas ainda falta escala horizontal (mais instâncias / autoscaling)."
                        if lb_cards
                        else "Sem load balancer e sem réplicas — gargalo certo sob pico."
                    )
                ),
            )
        )

    # 2. DB único para HA alta
    if avail >= 99.9 and len(db_cards) == 1 and not has_multi_az:
        node = db_cards[0]
        findings.append(
            Finding(
                node_id=str(node.get("id")),
                severity="critical",
                title="Banco único para alta disponibilidade",
                detail=(
                    f"{_node_data(node).get('label')} é o único store com meta de {avail}% disponibilidade "
                    "e sem Multi-AZ. SPOF: falha do DB derruba o sistema."
                ),
            )
        )

    # 3. Sem Redis com latência estrita
    if latency_ms is not None and latency_ms < 200 and users > 50_000 and not redis_cards and backend_cards:
        node = backend_cards[0]
        findings.append(
            Finding(
                node_id=str(node.get("id")),
                severity="warning",
                title="Sem cache para latência exigente",
                detail=(
                    f"p99 alvo {latency_ms}ms com ~{users:,} users/dia e nenhum Redis/ElastiCache. "
                    f"O backend {_node_data(node).get('label')} vai bater no banco a cada request."
                ),
            )
        )

    # 4. Sem fila em alta escala — skip for small monolith MVP (P1.2.2)
    if not users_threshold_scale and users > 100_000 and not queue_cards and not is_serverless and backend_cards:
        node = backend_cards[0]
        findings.append(
            Finding(
                node_id=str(node.get("id")),
                severity="warning",
                title="Sem fila/messaging em alta escala",
                detail=(
                    f"~{users:,} users/dia sem Kafka/SQS/Rabbit/NATS. "
                    f"Trabalho síncrono no {_node_data(node).get('label')} vira gargalo sob pico."
                ),
            )
        )

    # 5. Sem LB com vários backends — skip for small monolith MVP (P1.2.2)
    if not users_threshold_scale and len(backend_cards) > 2 and not lb_cards:
        for node in backend_cards:
            findings.append(
                Finding(
                    node_id=str(node.get("id")),
                    severity="critical",
                    title="Vários backends sem load balancer",
                    detail=(
                        f"{len(backend_cards)} backends e nenhum ALB/API Gateway. "
                        f"{_node_data(node).get('label')} não tem distribuição de tráfego."
                    ),
                )
            )

    # 6. S3/object storage sem CDN
    if users > 50_000 and s3_cards and not cdn_cards:
        for node in s3_cards:
            findings.append(
                Finding(
                    node_id=str(node.get("id")),
                    severity="warning",
                    title="Object storage sem CDN",
                    detail=(
                        f"{_node_data(node).get('label')} serve ~{users:,} users/dia sem CloudFront/CDN. "
                        "Latência e custo de egress sobem; o storage vira gargalo de entrega."
                    ),
                )
            )

    _ = edges  # reserved for hop-aware rules
    return findings


def analyze_trust_and_dr(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
) -> list[Any]:
    """Trust boundaries + DR (RPO/RTO) para infra enterprise."""
    from app.schemas.analysis import Finding

    nfr = nfr or ProjectNfr()
    findings: list[Finding] = []
    zones = [n for n in nodes if _node_data(n).get("kind") == "zone"]
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]
    zone_kinds = {_node_data(z).get("zoneKind") for z in zones}
    has_security = "security_boundary" in zone_kinds
    zone_by_id = {z.get("id"): z for z in zones}

    ownership = nfr.data_ownership or []
    pii_entities = {
        str(item.get("entity") or "").lower()
        for item in ownership
        if isinstance(item, dict) and item.get("pii")
    }

    def parent_zone_kind(node: dict) -> str | None:
        parent = zone_by_id.get(node.get("parentId"))
        if not parent:
            return None
        return _node_data(parent).get("zoneKind")

    for n in cards:
        blob = _card_blob(n)
        is_data = _node_data(n).get("kind") == "database" or any(
            k in blob for k in ("postgres", "mysql", "rds", "dynamo", "mongo")
        )
        if not is_data:
            continue
        zk = parent_zone_kind(n)
        label = _node_data(n).get("label") or n.get("id")
        if zk == "subnet_public":
            findings.append(
                Finding(
                    node_id=str(n.get("id")),
                    severity="critical",
                    title="Dado sensível fora do trust boundary",
                    detail=f"{label} está em subnet pública. Dados devem ficar em subnet privada + security_boundary.",
                )
            )
        if pii_entities and not has_security and zk != "security_boundary":
            findings.append(
                Finding(
                    node_id=str(n.get("id")),
                    severity="warning",
                    title="PII sem security boundary",
                    detail=f"Há entidades PII no NFR, mas {label} não está isolado em security_boundary.",
                )
            )

    avail = float(nfr.availability_pct or nfr.slo_availability_pct or 0)
    if avail >= 99.9 and (nfr.rpo_hours is None or nfr.rto_minutes is None):
        findings.append(
            Finding(
                severity="warning",
                title="Alta disponibilidade sem RPO/RTO",
                detail=(
                    f"Meta de {avail}% exige plano de DR. Defina rpo_hours e rto_minutes "
                    "(active-active, failover, backups)."
                ),
            )
        )

    hybrid = zone_kinds & {"vpn", "peering", "privatelink", "express_route"}
    if hybrid and not any((e.get("data") or {}).get("firewallRules") for e in edges):
        findings.append(
            Finding(
                severity="info",
                title="Links híbridos sem SG explícito",
                detail="Há VPN/peering/PrivateLink/ExpressRoute. Documente firewallRules nas arestas que cruzam a borda.",
            )
        )

    _ = edges
    return findings


def analyze_domain_benchmarks(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
) -> list[Any]:
    """Análise calibrada por domínio com benchmarks setoriais.

    Anti-falso-positivo: regras só disparam quando o domínio justifica.
    - Fintech exige compliance e ACID
    - Streaming exige CDN e CDN cache
    - IoT exige MQTT e edge processing
    - E-commerce exige checkout flow e inventory consistency
    """
    from app.schemas.analysis import Finding

    nfr = nfr or ProjectNfr()
    style = nfr.arch_style or "monolithic"
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]

    def blob(n: dict) -> str:
        return _card_blob(n)

    def matches(n: dict, *keys: str) -> bool:
        b = blob(n)
        return any(k in b for k in keys)

    findings: list[Finding] = []
    label = lambda n: _node_data(n).get("label") or ""

    # === Fintech benchmarks ===
    is_fintech = any(matches(n, "fintech", "banking", "payment", "stripe", "checkout", "ledger", "pci") for n in cards)
    if is_fintech:
        # Check for idempotency on payment edges
        payment_edges = [e for e in edges if matches(e.get("source") or {}, "payment", "checkout") and matches(e.get("target") or {}, "payment", "ledger")]
        if payment_edges:
            for edge in payment_edges:
                ed = edge.get("data") or {}
                if not ed.get("failureBehavior") or ed.get("failureBehavior") == "none":
                    findings.append(Finding(
                        node_id=str(edge.get("source")),
                        severity="warning",
                        title="Payment edge sem failure behavior",
                        detail=f"Pagamento de {label(nodes[0])} para {label(nodes[1])} sem retry/fallback. Transações financeiras exigem idempotência.",
                    ))
        # Check for audit trail
        has_audit = any(matches(n, "audit", "log", "immutable", "ledger") for n in cards)
        if not has_audit:
            findings.append(Finding(
                severity="critical",
                title="Sem audit trail para fintech",
                detail="Sistema financeiro exige rastreabilidade imutável de todas as transações.",
            ))
        # Check for ACID compliance
        db_cards = [n for n in cards if matches(n, "postgres", "mysql", "sql")]
        if db_cards and not any(matches(n, "nosql", "mongo", "dynamo") for n in cards):
            findings.append(Finding(
                severity="info",
                title="Bancos relacionais para fintech",
                detail="Postgres/MySQL com ACID são adequados para transações financeiras. Considere outbox pattern para eventos.",
            ))

    # === Streaming benchmarks ===
    is_streaming = any(matches(n, "stream", "video", "aws", "netflix", "twitch", "media", "cdn", "cloudfront") for n in cards)
    if is_streaming:
        cdn_cards = [n for n in cards if matches(n, "cloudfront", "cdn", "cloudflare", "fastly")]
        if not cdn_cards:
            findings.append(Finding(
                severity="critical",
                title="Streaming sem CDN é inviável",
                detail="Latência e custo de egress explodem sem CDN. Use CloudFront/Cloudflare/FASTLY.",
            ))
        # Check for transcoding
        has_transcode = any(matches(n, "transcode", "ffmpeg", "elastic transcoder") for n in cards)
        if has_transcode:
            findings.append(Finding(
                severity="info",
                title="Transcoding detectado",
                detail="Multi-bitrate streaming recomendado para adaptação de qualidade.",
            ))
        # Check for storage tiering
        has_s3 = any(matches(n, "s3", "blob", "gcs") for n in cards)
        if has_s3:
            findings.append(Finding(
                severity="info",
                title="Object storage para mídia",
                detail="Use S3 com lifecycle policies para tiering (standard → glacier).",
            ))

    # === IoT benchmarks ===
    is_iot = any(matches(n, "iot", "mqtt", "sensor", "device", "edge", " Things") for n in cards)
    if is_iot:
        has_mqtt = any(matches(n, "mqtt", "mosquitto", "emqx") for n in cards)
        if not has_mqtt:
            findings.append(Finding(
                severity="warning",
                title="IoT sem protocolo MQTT",
                detail="MQTT é o padrão para IoT. Considerar broker especializado (EMQX, Mosquitto).",
            ))
        # Check for edge processing
        has_edge = any(matches(n, "edge", "fog", "raspberry", "jetson") for n in cards)
        if not has_edge:
            findings.append(Finding(
                severity="info",
                title="IoT sem edge processing",
                detail="Processamento em borda reduz latência e custo de bandwidth para telemetria.",
            ))

    # === E-commerce benchmarks ===
    is_ecommerce = any(matches(n, "ecommerce", "shopify", "woocommerce", "inventory", "cart", "checkout") for n in cards)
    if is_ecommerce:
        # Check for inventory consistency
        has_inventory = any(matches(n, "inventory", "stock", "cart") for n in cards)
        if has_inventory:
            consistency = nfr.consistency_patterns or {}
            if consistency.get("inventory") != "strong":
                findings.append(Finding(
                    severity="warning",
                    title="Inventory com consistência fraca",
                    detail="Estoque exige consistência forte (sell-out > oversell). Use transações ACID.",
                ))
        # Check for session management
        has_session = any(matches(n, "session", "redis", "sticky") for n in cards)
        if not has_session:
            findings.append(Finding(
                severity="info",
                title="E-commerce sem session management",
                detail="Carrinho de compras exige session persistence. Redis é ideal.",
            ))

    return findings


def boost_style_from_zones(nodes: list[dict], style: str, confidence: float) -> tuple[str, float]:
    """Ajusta estilo quando o grafo tem zonas/serverless explícitos."""
    blobs: list[str] = []
    zone_kinds: set[str] = set()
    for n in nodes:
        d = _node_data(n)
        if d.get("kind") == "zone":
            zk = d.get("zoneKind")
            if isinstance(zk, str):
                zone_kinds.add(zk)
        blobs.append(str(d.get("label") or "").lower())
        blobs.append(str(d.get("tech") or "").lower())
        blobs.append(str(d.get("catalogId") or "").lower())
    text = " ".join(blobs)
    if "lambda" in text or "functions" in text or "serverless" in text:
        return "serverless", max(confidence, 0.65)
    if "event hub" in text or "kafka" in text or "pub/sub" in text or "sqs" in text:
        return "event_driven", max(confidence, 0.6)
    if "availability_zone" in zone_kinds or "vpc" in zone_kinds:
        if style == "monolithic":
            return "layered", max(confidence, 0.55)
    return style, confidence


def _clamp10(value: float) -> float:
    return round(max(0.0, min(10.0, value)), 1)


def _edge_data(edge: dict) -> dict:
    return edge.get("data") or {}


def _card_blob(node: dict) -> str:
    d = _node_data(node)
    cfg = d.get("config") or {}
    return " ".join(
        [
            str(d.get("label") or ""),
            str(d.get("tech") or ""),
            str(d.get("catalogId") or ""),
            str(cfg.get("service") or ""),
            str(cfg.get("capability") or ""),
            str(d.get("kind") or ""),
        ]
    ).lower()


def score_diagram_narrative(nodes: list[dict], edges: list[dict]) -> tuple[float, list[str]]:
    """Clareza narrativa: numeração, labels e protocolos nas arestas."""
    gaps: list[str] = []
    if not edges:
        return 3.0, ["Sem arestas — não há história do request."]

    numbered = []
    missing_label = 0
    missing_protocol = 0
    for e in edges:
        d = _edge_data(e)
        num = d.get("flowNumber")
        if isinstance(num, int):
            numbered.append(num)
        if not (d.get("label") or "").strip() and d.get("flowNumber") is None:
            missing_label += 1
        if not d.get("protocol"):
            missing_protocol += 1

    score = 7.0
    if not numbered:
        score -= 3.0
        gaps.append("Fluxos sem numeração — um arquiteto não consegue seguir a sequência.")
    else:
        unique_nums = sorted(set(numbered))
        expected = list(range(unique_nums[0], unique_nums[-1] + 1))
        missing = [n for n in expected if n not in unique_nums]
        if missing:
            score -= min(2.5, 0.5 * len(missing))
            gaps.append(f"Numeração com gaps: faltam passos {missing[:8]}.")
        if len(numbered) >= 3:
            score += 1.0

    if missing_label:
        score -= min(2.0, 0.3 * missing_label)
        gaps.append(f"{missing_label} aresta(s) sem label nem número.")
    if missing_protocol:
        score -= min(1.5, 0.2 * missing_protocol)
        gaps.append(f"{missing_protocol} aresta(s) sem protocol.")

    zones = sum(1 for n in nodes if _node_data(n).get("kind") == "zone")
    if zones:
        score += 0.5
    return _clamp10(score), gaps


def score_flow_continuity(nodes: list[dict], edges: list[dict]) -> tuple[float, list[str]]:
    """Continuidade: hops conectados e anti-padrão Dynamo→S3 direto."""
    gaps: list[str] = []
    if not edges:
        return 2.0, ["Sem fluxos para avaliar continuidade."]

    score = 7.5
    ids = {str(n.get("id")) for n in nodes}
    dangling = 0
    for e in edges:
        src, tgt = str(e.get("source")), str(e.get("target"))
        if src not in ids or tgt not in ids:
            dangling += 1
    if dangling:
        score -= min(3.0, dangling)
        gaps.append(f"{dangling} aresta(s) com endpoints inválidos.")

    # Anti-padrão: storage → storage sem compute no caminho (ex. Dynamo→S3)
    by_id = {str(n.get("id")): n for n in nodes}
    for e in edges:
        src = by_id.get(str(e.get("source")))
        tgt = by_id.get(str(e.get("target")))
        if not src or not tgt:
            continue
        sb, tb = _card_blob(src), _card_blob(tgt)
        src_store = "dynamo" in sb or _node_data(src).get("kind") == "database"
        tgt_store = "s3" in tb or "blob" in tb or "storage" in tb
        if src_store and tgt_store:
            score -= 2.0
            gaps.append(
                "Possível hop mágico storage→storage (ex. Dynamo→S3). "
                "Documente Stream/Lambda/Export no meio."
            )
            break

    protocols_ok = sum(1 for e in edges if _edge_data(e).get("protocol"))
    if edges and protocols_ok / len(edges) >= 0.8:
        score += 1.0
    return _clamp10(score), gaps


def score_placement(nodes: list[dict]) -> tuple[float, list[str]]:
    """Correção de placement zona vs componente."""
    gaps: list[str] = []
    zones = {str(n.get("id")): n for n in nodes if _node_data(n).get("kind") == "zone"}
    cards = [n for n in nodes if _node_data(n).get("kind") not in {"zone", "block", None}]
    if not cards:
        return 4.0, ["Sem componentes para avaliar placement."]

    score = 8.0
    for n in cards:
        blob = _card_blob(n)
        parent_id = n.get("parentId")
        parent = zones.get(str(parent_id)) if parent_id else None
        parent_kind = _node_data(parent).get("zoneKind") if parent else None
        parent_label = (_node_data(parent).get("label") or "").lower() if parent else ""

        is_data = _node_data(n).get("kind") == "database" or any(
            k in blob for k in ("postgres", "mysql", "dynamo", "rds", "sql", "cosmos")
        )
        is_compute = any(k in blob for k in ("lambda", "ecs", "functions", "fargate", "ec2", "cloud run"))
        is_iot = "iot" in blob
        is_obs = _node_data(n).get("kind") == "observability" or any(
            k in blob for k in ("cloudwatch", "monitor", "prometheus", "grafana", "x-ray")
        )

        if is_data and parent_kind == "subnet_public":
            score -= 2.5
            gaps.append(f"{_node_data(n).get('label')}: dado em subnet pública.")
        if is_compute and parent_kind == "subnet_public":
            score -= 1.0
            gaps.append(f"{_node_data(n).get('label')}: compute em subnet pública.")
        if is_iot and (parent_kind in {"layer", "plane"} or "observ" in parent_label) and not is_obs:
            # IoT dentro de zona de observabilidade sem ser telemetria clara
            if "observ" in parent_label:
                score -= 1.5
                gaps.append(
                    f"{_node_data(n).get('label')}: IoT em Observability — só ok se for telemetria explícita."
                )
        if (is_data or "s3" in blob) and "control" in parent_label:
            score -= 1.5
            gaps.append(
                f"{_node_data(n).get('label')}: storage no Control Plane sem justificativa típica."
            )

    zone_kinds = {_node_data(z).get("zoneKind") for z in zones.values()}
    if "vpc" in zone_kinds and "subnet_private" not in zone_kinds:
        score -= 1.0
        gaps.append("VPC sem subnet privada.")
    if "availability_zone" in zone_kinds:
        az_n = sum(1 for z in zones.values() if _node_data(z).get("zoneKind") == "availability_zone")
        if az_n < 2:
            score -= 0.8
            gaps.append("Uma única AZ — HA incompleto.")

    return _clamp10(score), gaps


def score_views_completeness(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None,
) -> tuple[float, list[str]]:
    """Completude AN/AD/AA/AI."""
    gaps: list[str] = []
    score = 0.0
    # AI — zonas ou cards de infra
    has_zones = any(_node_data(n).get("kind") == "zone" for n in nodes)
    has_cards = any(_node_data(n).get("kind") not in {"zone", "block", None} for n in nodes)
    if has_zones or has_cards:
        score += 2.5
    else:
        gaps.append("Vista AI vazia (sem zonas/componentes).")

    # AA — backends/integrações/estilo
    has_aa = any(
        _node_data(n).get("kind") in {"backend", "integration", "frontend"}
        or any(k in _card_blob(n) for k in ("api", "gateway", "lambda", "ecs", "functions"))
        for n in nodes
    )
    if has_aa:
        score += 2.0
    else:
        gaps.append("Vista AA fraca — falta serviço/API de aplicação.")
    if nfr and nfr.arch_style:
        score += 0.5
    else:
        gaps.append("Estilo arquitetural (AA) não declarado.")

    # AN
    if nfr and nfr.business_processes:
        score += 2.5
    else:
        gaps.append("Vista AN ausente — declare processos de negócio.")

    # AD
    if nfr and nfr.data_entities:
        score += 2.0
    else:
        gaps.append("Vista AD ausente — declare entidades de dados.")
    if nfr and nfr.data_governance:
        score += 0.5

    if edges:
        score += 0.5
    return _clamp10(score), gaps


def score_operability(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None,
) -> tuple[float, list[str]]:
    """Observabilidade, failure behavior, ambientes."""
    gaps: list[str] = []
    score = 5.0
    has_obs = any(
        _node_data(n).get("kind") == "observability"
        or any(k in _card_blob(n) for k in ("cloudwatch", "monitor", "prometheus", "grafana", "x-ray", "app insights"))
        for n in nodes
    )
    if has_obs:
        score += 2.0
    else:
        gaps.append("Sem observabilidade no desenho.")

    critical_ids = set((nfr.critical_path_edge_ids if nfr else None) or [])
    critical_edges = [
        e
        for e in edges
        if str(e.get("id")) in critical_ids or _edge_data(e).get("isCriticalPath") is True
    ]
    if critical_edges or critical_ids:
        score += 1.0
        with_fb = sum(
            1
            for e in critical_edges
            if _edge_data(e).get("failureBehavior") not in (None, "none")
        )
        if critical_edges and with_fb == 0:
            score -= 1.0
            gaps.append("Caminho crítico sem failureBehavior (retry/fallback/dlq).")
        elif with_fb:
            score += 0.5
    else:
        gaps.append("Marque o caminho crítico (isCriticalPath ou critical_path_edge_ids).")

    if nfr and nfr.failure_modes:
        score += 1.0
    else:
        gaps.append("Documente pelo menos um failure mode.")

    env = nfr.environments if nfr else None
    if env and env.has_monitoring_plan:
        score += 0.5
    if env and env.has_backups:
        score += 0.3
    if env and env.has_prod:
        score += 0.2

    slo_ok = bool(
        nfr
        and (
            nfr.slo_availability_pct is not None
            or nfr.availability_pct is not None
            or nfr.slo_latency_p99_ms is not None
            or nfr.latency_p99_ms is not None
        )
    )
    if slo_ok:
        score += 0.5
    else:
        gaps.append("Defina SLO/NFR de disponibilidade ou latência.")

    return _clamp10(score), gaps


def score_decision_quality(
    nfr: ProjectNfr | None,
    trade_offs: list[TradeOffEntry] | None,
) -> tuple[float, list[str]]:
    """Trade-offs, AN/AD, estilo, SLOs."""
    gaps: list[str] = []
    score = 4.0
    if nfr and nfr.arch_style:
        score += 1.5
    else:
        gaps.append("Escolha um estilo arquitetural.")
    if nfr and nfr.business_processes:
        score += 1.0
    if nfr and nfr.data_entities:
        score += 1.0
    if trade_offs:
        score += min(2.0, 0.7 * len(trade_offs))
    else:
        gaps.append("Nenhum trade-off documentado.")
    if nfr and (nfr.slo_availability_pct is not None or nfr.availability_pct is not None):
        score += 0.5
    if nfr and nfr.compliance:
        score += 0.5
    return _clamp10(score), gaps


def build_review_scorecard(
    nodes: list[dict],
    edges: list[dict],
    nfr: ProjectNfr | None = None,
    trade_offs: list[TradeOffEntry] | None = None,
    domain_coherence: DomainCoherenceScore | None = None,
) -> ReviewScorecard:
    """Agrega os 6 eixos do design review. review_ready se overall >= 8 e nenhum eixo < 5."""
    narrative, g1 = score_diagram_narrative(nodes, edges)
    views, g2 = score_views_completeness(nodes, edges, nfr)
    if domain_coherence and domain_coherence.geral >= 7:
        views = _clamp10(views + 0.5)
    placement, g3 = score_placement(nodes)
    continuity, g4 = score_flow_continuity(nodes, edges)
    operability, g5 = score_operability(nodes, edges, nfr)
    decision, g6 = score_decision_quality(nfr, trade_offs)

    axes = [narrative, views, placement, continuity, operability, decision]
    overall = _clamp10(sum(axes) / len(axes))
    review_ready = overall >= 8.0 and all(a >= 5.0 for a in axes)
    gaps = list(dict.fromkeys([*g1, *g2, *g3, *g4, *g5, *g6]))[:12]

    return ReviewScorecard(
        narrative=narrative,
        views_completeness=views,
        placement=placement,
        flow_continuity=continuity,
        operability=operability,
        decision_quality=decision,
        overall=overall,
        review_ready=review_ready,
        gaps=gaps,
    )


def validate_firewall_rules(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """Validates firewall rules on edges crossing security boundaries.
    Returns findings with node_id, severity, and suggested fix."""
    from collections.abc import Iterator

    findings: list[dict] = []

    # Build a map of node_id -> zone_kind
    node_zones: dict[str, str] = {}
    node_kinds: dict[str, str] = {}
    node_labels: dict[str, str] = {}
    node_map: dict[str, dict] = {}

    for n in nodes:
        nid = str(n.get("id", ""))
        d = _node_data(n)
        node_kinds[nid] = d.get("kind", "")
        node_labels[nid] = d.get("label", "")
        node_map[nid] = n
        if d.get("kind") == "zone":
            node_zones[nid] = d.get("zoneKind", "")

    # Find root zones (zones without a parent zone)
    root_zones: set[str] = set()
    for nid, zk in node_zones.items():
        parent_id = str(nodes[[n.get("id") for n in nodes].index(nid)].get("parentId", "")) if nid in [n.get("id") for n in nodes] else ""
        # A root zone is one whose parent is not a zone
        parent_kind = node_kinds.get(parent_id, "")
        if parent_kind != "zone":
            root_zones.add(nid)

    # For each edge, check if it crosses from public to private zone
    for edge in edges:
        src_id = str(edge.get("source", ""))
        tgt_id = str(edge.get("target", ""))
        edge_data = edge.get("data", {}) or {}
        firewall_rules = edge_data.get("firewallRules")

        # Find the zone context for source and target
        src_zone = _find_zone_ancestor(src_id, nodes, node_zones)
        tgt_zone = _find_zone_ancestor(tgt_id, nodes, node_zones)

        # Check: public -> private without firewall rules
        if src_zone == "subnet_public" and tgt_zone == "subnet_private":
            if not firewall_rules:
                findings.append({
                    "severity": "critical",
                    "node_id": src_id,
                    "message": f"Fluxo de 'Public' ({node_labels.get(src_id, src_id)}) para 'Private' ({node_labels.get(tgt_id, tgt_id)}) sem regra de Firewall/Security Group",
                    "fix": "Adicione firewallRules na aresta: [{\"port\": \"443\", \"protocol\": \"tcp\", \"direction\": \"inbound\"}]",
                })
            elif not any(r.get("direction") == "inbound" for r in firewall_rules):
                findings.append({
                    "severity": "warning",
                    "node_id": src_id,
                    "message": f"Fluxo Public→Private sem regra inbound explícita",
                    "fix": "Adicione uma regra inbound (ex: port 443, tcp)",
                })

        # Check: internet -> VPC without WAF
        if not src_zone and node_kinds.get(src_id) == "cloud":
            src_catalog = str(_node_data(nodes[[n.get("id") for n in nodes].index(src_id)]).get("catalogId", "")) if src_id in [n.get("id") for n in nodes] else ""
            if "waf" in src_catalog.lower() or "cdn" in src_catalog.lower() or "api-gateway" in src_catalog.lower():
                continue  # Protected by WAF/CDN
            if tgt_zone == "subnet_private" or tgt_zone == "vpc":
                findings.append({
                    "severity": "warning",
                    "node_id": src_id,
                    "message": f"Recurso externo ({node_labels.get(src_id, src_id)}) acessando VPC/privado sem WAF visível",
                    "fix": "Considere adicionar um WAF ou API Gateway como ponto de entrada",
                })

    return findings


def _find_zone_ancestor(node_id: str, nodes: list[dict], node_zones: dict[str, str]) -> str | None:
    """Find the zone kind of the nearest zone ancestor of a node."""
    nid_list = [n.get("id") for n in nodes]
    current_id = node_id
    while current_id:
        if current_id in node_zones:
            return node_zones[current_id]
        idx = nid_list.index(current_id) if current_id in nid_list else -1
        if idx < 0:
            break
        parent_id = nodes[idx].get("parentId")
        if not parent_id:
            break
        current_id = str(parent_id)
    return None
