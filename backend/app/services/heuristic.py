from __future__ import annotations

from collections import Counter

from app.schemas.analysis import (
    AnalysisResult,
    Finding,
    GrowthReport,
    GrowthScenario,
    MetricEstimate,
)
from app.services.knowledge import COMPLEXITY, COST_USD_MONTH, THROUGHPUT_RPS


def _node_data(node: dict) -> dict:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _techs(nodes: list[dict]) -> list[str]:
    techs: list[str] = []
    for node in nodes:
        data = _node_data(node)
        config = data.get("config") or {}
        for key in ("framework", "engine", "service", "tech"):
            value = config.get(key) or data.get(key)
            if isinstance(value, str) and value:
                techs.append(value)
        if isinstance(data.get("tech"), str):
            techs.append(data["tech"])
    return techs


def _ids_by_kind(nodes: list[dict]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {
        "frontend": [],
        "backend": [],
        "database": [],
        "cloud": [],
        "identity": [],
        "observability": [],
        "integration": [],
        "deploy": [],
    }
    for node in nodes:
        data = _node_data(node)
        kind = data.get("kind")
        if kind in grouped:
            grouped[kind].append(str(node.get("id")))
    return grouped


def _has_service(nodes: list[dict], *names: str) -> bool:
    blob = " ".join(_techs(nodes)).lower()
    return any(name.lower() in blob for name in names)


def estimate_monthly_cost(nodes: list[dict]) -> float:
    cost = 0.0
    techs = [t.lower() for t in _techs(nodes)]
    if any("ec2" in t for t in techs):
        cost += COST_USD_MONTH["EC2:t3.medium"]
    if any("rds" in t or "postgresql" in t or "mysql" in t for t in techs) and any(
        "hostinger" not in t and "digital" not in t for t in techs
    ):
        cost += COST_USD_MONTH["RDS:db.t3.micro"]
    if any("load balancer" in t or "alb" in t for t in techs):
        cost += COST_USD_MONTH["ALB"]
    if any("lambda" in t for t in techs):
        cost += 8.0
    if any("s3" in t for t in techs):
        cost += COST_USD_MONTH["S3:50GB"]
    if any("cloudfront" in t for t in techs):
        cost += COST_USD_MONTH["CloudFront:50GB"]
    if any("elasticache" in t or t == "redis" for t in techs):
        cost += COST_USD_MONTH["ElastiCache:t3.micro"]
    if any("hostinger" in t for t in techs):
        cost += COST_USD_MONTH["Hostinger VPS"]
    if any("digital" in t for t in techs):
        cost += COST_USD_MONTH["DigitalOcean droplet 2GB"]
    # Deploy platforms
    if any("vercel" in t for t in techs):
        cost += COST_USD_MONTH["Vercel:Pro"]
    if any("netlify" in t for t in techs):
        cost += COST_USD_MONTH["Netlify:Pro"]
    if any("railway" in t for t in techs):
        cost += COST_USD_MONTH["Railway:Starter"]
    if any("fly.io" in t or "flyio" in t for t in techs):
        cost += COST_USD_MONTH["Fly.io:Scale"]
    if any("render" in t for t in techs):
        cost += COST_USD_MONTH["Render:Starter"]
    if any("kubernetes" in t or "k8s" in t for t in techs):
        cost += COST_USD_MONTH["Kubernetes:managed"]
    return round(cost or 12.0, 2)


def complexity_score(nodes: list[dict]) -> int:
    return sum(COMPLEXITY.get(tech, 2) for tech in set(_techs(nodes)))


def analyze_graph(nodes: list[dict], edges: list[dict]) -> AnalysisResult:
    findings: list[Finding] = []
    strengths: list[str] = []
    risks: list[str] = []
    suggestions: list[str] = []
    node_scores: dict[str, float] = {}
    grouped = _ids_by_kind(nodes)
    techs = _techs(nodes)
    tech_set = set(techs)
    backends = [t for t in techs if t in THROUGHPUT_RPS]
    primary_backend = backends[0] if backends else None
    cost = estimate_monthly_cost(nodes)
    has_lb = _has_service(nodes, "Load Balancer", "ALB")
    has_lambda = _has_service(nodes, "Lambda")
    has_ec2 = _has_service(nodes, "EC2", "Droplet", "VPS", "Hostinger")
    has_cdn = _has_service(nodes, "CloudFront")
    has_cache = _has_service(nodes, "Redis", "ElastiCache")
    has_postgres = _has_service(nodes, "PostgreSQL")
    has_dynamo = _has_service(nodes, "DynamoDB")
    has_cassandra = _has_service(nodes, "Cassandra")
    has_s3 = _has_service(nodes, "S3")
    tiny = len(nodes) <= 4

    for node in nodes:
        data = _node_data(node)
        nid = str(node.get("id"))
        score = 7.5
        kind = data.get("kind")
        framework = (data.get("config") or {}).get("framework")
        if kind == "backend" and framework == "Django" and tiny:
            score = 5.5
            findings.append(
                Finding(
                    node_id=nid,
                    severity="warning",
                    title="Django pode ser overengineering",
                    detail=(
                        "Django para um desenho pequeno (poucos nodes) é como atirar bazuca em formiga — "
                        "ORM, admin e app structure não se pagam numa API enxuta. FastAPI ou Flask "
                        "resolveriam com menos complexidade operacional."
                    ),
                )
            )
        if kind == "backend" and framework == "Spring Boot" and tiny:
            score = 5.0
            findings.append(
                Finding(
                    node_id=nid,
                    severity="warning",
                    title="Spring Boot pesado para o tamanho do sistema",
                    detail="JVM + Spring só se justificam com time Java e domínio complexo. Para um MVP, NestJS/FastAPI reduzem ops.",
                )
            )
        if kind == "database" and has_cassandra and tiny:
            score = 4.0
            findings.append(
                Finding(
                    node_id=nid,
                    severity="critical",
                    title="Cassandra sem escala que justifique",
                    detail="Cassandra brilha em escrita multi-região e volume enorme. Em desenho pequeno o custo operacional (repair, consistência) não se paga. PostgreSQL cobre 95% dos casos.",
                )
            )
        if kind == "cloud" and (data.get("config") or {}).get("service") == "S3" and not grouped["backend"] and not has_lambda:
            findings.append(
                Finding(
                    node_id=nid,
                    severity="info",
                    title="S3 não executa a aplicação",
                    detail="S3 é object storage. Precisa de compute (EC2/ECS/Lambda) ou hosting estático + API separada.",
                )
            )
            score = 6.0
        node_scores[nid] = score

    if primary_backend:
        band = THROUGHPUT_RPS[primary_backend]
        findings.append(
            Finding(
                severity="info",
                title=f"Capacidade estimada de {primary_backend}",
                detail=(
                    f"{primary_backend} + PostgreSQL numa única instância EC2 t3.medium aguenta cerca de "
                    f"{band['low']}-{band['high']} req/s em leitura JSON simples ({band['note']}). "
                    "Degrada rápido acima disso por conexões do Postgres, workers e (no CPython) o GIL. "
                    "Número de ordem de grandeza, não um load test."
                ),
                metric=MetricEstimate(
                    label="RPS estimado (t3.medium)",
                    value=f"{band['low']}-{band['high']}",
                    unit="req/s",
                ),
            )
        )

    if not grouped["backend"]:
        risks.append("Não há backend explícito — a API e regras de negócio ficam indefinidas.")
        suggestions.append("Adicione um runtime de API (FastAPI, NestJS, etc.).")
    if not grouped["database"]:
        risks.append("Sem banco explícito. Estado vai parar em memória ou storage improvisado.")
    if not grouped["cloud"]:
        risks.append("Sem alvo de infra — custo e teto de escala ficam no escuro.")
        suggestions.append("Escolha pelo menos um compute (EC2/VPS/Lambda) e um storage.")

    if has_lb and tiny and not has_lambda:
        findings.append(
            Finding(
                severity="warning",
                title="Load balancer provavelmente cedo demais",
                detail="Com ~1 mil usuários esporádicos, um ALB (~US$16+/mês + LCU) adiciona custo e superfície sem ganho de HA se só existe uma instância atrás. Espere tráfego constante ou segundo node.",
                metric=MetricEstimate(label="Custo ALB ordem de grandeza", value="16-30", unit="USD/mês"),
            )
        )
    if has_ec2 and not has_lb:
        suggestions.append("Para HA em cenário médio, coloque 2 instâncias atrás de um load balancer.")

    if has_lambda and has_ec2:
        findings.append(
            Finding(
                severity="info",
                title="Lambda e EC2 juntos",
                detail="Faz sentido se Lambda cobre jobs/webhooks e EC2 a API constante. Se os dois servem o mesmo tráfego HTTP, você paga complexidade dupla de deploy, IAM e observabilidade.",
            )
        )

    if has_dynamo and has_postgres:
        findings.append(
            Finding(
                severity="warning",
                title="Dois sistemas de registro",
                detail="PostgreSQL + DynamoDB só se justificam com padrões de acesso muito diferentes (relacional vs key-value em escala). Caso contrário, escolha um e evite sync/dual-write.",
            )
        )

    if grouped["frontend"] and not has_cdn and _has_service(nodes, "Next.js", "React"):
        suggestions.append("CloudFront (ou CDN equivalente) reduz TTFB global e tira carga do origin em estáticos/SSR cacheável.")

    if has_postgres and not has_cache:
        suggestions.append("Redis/ElastiCache alivia sessão e hot keys antes de escalar verticalmente o Postgres.")

    if has_s3:
        strengths.append("S3 como storage desacoplado escala sem gerenciar disco de VM.")
    if primary_backend in {"FastAPI", "Express", "NestJS"}:
        strengths.append(f"{primary_backend} tem boa densidade de RPS por dólar em I/O bound.")
    if has_postgres:
        strengths.append("PostgreSQL cobre modelo relacional, JSONB e transações com ecossistema maduro.")

    if not grouped["identity"] and not any(
        "auth" in (str(_node_data(n).get("label", "")).lower())
        or "jwt" in " ".join(_techs(nodes)).lower()
        or "cognito" in " ".join(_techs(nodes)).lower()
        for n in nodes
    ):
        risks.append("Nenhuma peça de Identidade/Auth no canvas — risco de API sem authn/z explícito.")
        suggestions.append("Adicione Cognito/Auth0/Keycloak/JWT no bloco Identidade.")
        findings.append(
            Finding(
                severity="critical",
                title="Auth ausente no desenho",
                detail="Kickoff de projeto quase sempre precisa de login/SSO antes do go-live.",
            )
        )

    if not grouped["observability"]:
        risks.append("Sem Observabilidade (métricas/logs/tracing) — incidentes em produção ficam cegos.")
        suggestions.append("Inclua Prometheus/Grafana, OpenTelemetry, Sentry ou CloudWatch.")
        findings.append(
            Finding(
                severity="warning",
                title="Observabilidade não desenhada",
                detail="Para escala média/alta, telemetria deixa de ser opcional.",
            )
        )

    has_queue = _has_service(nodes, "SQS", "RabbitMQ", "Kafka", "NATS", "Pulsar", "Redis Streams")
    if grouped["integration"] and not has_queue:
        suggestions.append("Integrações (pagamento/webhook) costumam combinar bem com fila para retries idempotentes.")

    if not has_queue:
        suggestions.append("Se houver picos ou jobs longos, considere SQS/Rabbit/Kafka para processamento assíncrono.")

    small = GrowthScenario(
        ok=True,
        issues=[] if has_ec2 or has_lambda or _has_service(nodes, "VPS", "Droplet") else ["Falta compute barato para o estágio pequeno."],
        changes=[] if not has_lb else ["Dá para adiar o load balancer e um único VPS/EC2 small."],
    )
    medium_issues = []
    medium_changes = []
    if not has_lb and not has_lambda:
        medium_issues.append("Uma VM é SPOF sob tráfego constante.")
        medium_changes.append("Adicionar load balancer + 2 instâncias (ou ECS service com 2 tasks).")
    if has_postgres and not has_cache:
        medium_changes.append("Cache Redis para sessões e queries quentes.")
    if not has_cdn:
        medium_changes.append("CDN na frente do frontend/SSR.")
    medium = GrowthScenario(ok=len(medium_issues) == 0, issues=medium_issues, changes=medium_changes)

    large_changes = [
        "Multi-AZ no mínimo; multi-região se latência/compliance exigirem.",
        "Fila (SQS/PubSub) para trabalho assíncrono e picos.",
        "Read replicas / partitioning no banco relacional, ou especializar store.",
        "Observabilidade (métricas, traces, SLOs) deixa de ser opcional.",
    ]
    large_issues = ["Teto vertical de uma VM/Postgres único não segura 1M+ usuários ativos."]
    if has_lambda:
        large_issues.append("Lambda em tráfego constante alto pode ficar mais caro e difícil de limitar latência p99 vs containers.")
        large_changes.append("Avaliar ECS/EKS para o caminho quente e Lambda só para eventos.")
    large = GrowthScenario(ok=False, issues=large_issues, changes=large_changes)

    score = 8.0
    if tiny and ("Django" in tech_set or "Spring Boot" in tech_set or "Cassandra" in tech_set):
        score -= 1.5
    if not grouped["backend"] or not grouped["database"]:
        score -= 1.5
    if not grouped["identity"]:
        score -= 0.8
    if not grouped["observability"]:
        score -= 0.3
    if has_lb and tiny:
        score -= 0.4
    if has_postgres and primary_backend:
        score += 0.4
    if has_cdn:
        score += 0.2
    score = max(3.0, min(9.6, round(score, 1)))

    counts = Counter(data.get("kind") for data in (_node_data(n) for n in nodes))
    summary = (
        f"Arquitetura: {score}/10 — {counts.get('frontend', 0)} FE, "
        f"{counts.get('backend', 0)} BE, {counts.get('database', 0)} dados, "
        f"{counts.get('cloud', 0)} infra, {counts.get('identity', 0)} id, "
        f"{counts.get('observability', 0)} obs, "
        f"{counts.get('integration', 0)} int, {counts.get('deploy', 0)} deploy. Custo ~US$ {cost}/mês (estimativa). "
        f"{'Stack enxuta e coerente.' if score >= 8 else 'Há over/under-engineering a revisar.'}"
    )
    findings.append(
        Finding(
            severity="info",
            title="Custo mensal de infra (ordem de grandeza)",
            detail="Soma heurística de list prices us-east-1 / VPS entry-level, sem Reserved/Savings Plans nem tráfego real.",
            metric=MetricEstimate(label="Custo mensal estimado", value=str(cost), unit="USD"),
        )
    )

    return AnalysisResult(
        score=score,
        summary=summary,
        strengths=strengths or ["Desenho inicial suficiente para discutir trade-offs."],
        risks=risks or ["Risco principal é operar sem medição (RPS/custo ainda são estimativas)."],
        suggestions=suggestions or ["Instrumentar um load test sintético antes de cravar o sizing."],
        findings=findings,
        node_scores=node_scores,
        growth=GrowthReport(small=small, medium=medium, large=large),
        ia_ok=False,
        ia_unavailable=False,
        agents_used=["heuristic"],
    )


def compare_analyses(left: AnalysisResult, right: AnalysisResult) -> dict:
    left_cost = next((f.metric.value for f in left.findings if f.metric and "Custo" in f.metric.label), "0")
    right_cost = next((f.metric.value for f in right.findings if f.metric and "Custo" in f.metric.label), "0")
    try:
        cheaper = "left" if float(left_cost) < float(right_cost) else "right" if float(right_cost) < float(left_cost) else "tie"
    except ValueError:
        cheaper = "tie"
    simpler = "left" if len(left.findings) < len(right.findings) else "right" if len(right.findings) < len(left.findings) else "tie"
    notes = [
        f"Nota A {left.score:.1f} vs B {right.score:.1f}.",
        f"Custo estimado A US$ {left_cost} vs B US$ {right_cost} /mês.",
        "Números são estimativas heurísticas, não cotações.",
    ]
    if left.score > right.score:
        notes.append("A está mais equilibrada no score consolidado; leia riscos antes de copiar a stack.")
    elif right.score > left.score:
        notes.append("B está mais equilibrada no score consolidado; leia riscos antes de copiar a stack.")
    return {
        "score_delta": round(left.score - right.score, 2),
        "cheaper": cheaper,
        "simpler": simpler,
        "notes": notes,
    }
