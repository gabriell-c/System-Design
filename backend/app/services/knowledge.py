"""Heurísticas de mercado (ordens de grandeza públicas, não medições)."""

from __future__ import annotations

THROUGHPUT_RPS = {
    "Flask": {"low": 200, "high": 600, "note": "gunicorn sync, 2-4 workers, JSON simples"},
    "Django": {"low": 150, "high": 400, "note": "WSGI + ORM; admin/ORM adicionam overhead"},
    "FastAPI": {"low": 800, "high": 3000, "note": "uvicorn async, I/O bound"},
    "Express": {"low": 2000, "high": 8000, "note": "event loop Node, JSON simples"},
    "NestJS": {"low": 1000, "high": 4000, "note": "Express/Fastify por baixo"},
    "Spring Boot": {"low": 3000, "high": 15000, "note": "JVM aquecida, Tomcat/Netty"},
    "Laravel": {"low": 200, "high": 800, "note": "PHP-FPM, depende de opcache"},
}

COST_USD_MONTH = {
    "EC2:t3.medium": 30.0,
    "EC2:t3.large": 61.0,
    "RDS:db.t3.micro": 13.0,
    "RDS:db.t3.medium": 50.0,
    "ALB": 22.0,
    "Lambda:1M": 0.2,
    "S3:50GB": 1.2,
    "CloudFront:50GB": 4.3,
    "ElastiCache:t3.micro": 12.0,
    "Hostinger VPS": 7.0,
    "DigitalOcean droplet 2GB": 12.0,
}

POSTGRES_DEFAULT_MAX_CONN = 100
POSTGRES_PRACTICAL_ON_T3_MEDIUM = 50

COMPLEXITY = {
    "React": 2,
    "Next.js": 3,
    "Vue": 2,
    "Angular": 4,
    "Svelte": 2,
    "Flask": 1,
    "FastAPI": 2,
    "Express": 1,
    "NestJS": 3,
    "Django": 4,
    "Laravel": 3,
    "Spring Boot": 5,
    "PostgreSQL": 3,
    "MySQL": 3,
    "MariaDB": 3,
    "MongoDB": 3,
    "DynamoDB": 4,
    "Redis": 2,
    "Cassandra": 5,
    "EC2": 2,
    "ECS": 4,
    "Lambda": 3,
    "S3": 1,
    "RDS": 3,
    "CloudFront": 2,
    "Load Balancer": 3,
    "ElastiCache": 3,
}

KNOWLEDGE_PROMPT = """
Você é um Software Architect / Principal Engineer. Toda métrica quantitativa
(RPS, custo, usuários) é ESTIMATIVA heurística baseada em benchmarks públicos
(TechEmpower, docs AWS us-east-1 2024-2026) — nunca apresente como medição.

Ordens de grandeza:
- Flask+gunicorn sync 2-4 workers: ~200-600 RPS JSON simples.
- FastAPI+uvicorn async: ~800-3000 RPS I/O bound.
- Django WSGI: ~150-400 RPS; ORM/admin não se pagam numa API de poucos endpoints.
- Express: ~2k-8k RPS JSON simples.
- Postgres default max_connections=100; em t3.medium (4 GB) o prático é ~40-80.
  Acima disso precisa PgBouncer. Gargalo típico: conexões, não CPU do app.
- GIL do CPython: workers sync não escalam CPU-bound no mesmo processo.
- EC2 t3.medium on-demand ~US$30/mês; ALB ~US$16+LCU; RDS t3.micro ~US$13.
- Lambda: ótimo para tráfego esporádico; cold start + limite de duração; custo
  explode em tráfego constante alto vs EC2 bem dimensionado.
- S3 não substitui compute. CloudFront faz sentido com assets/SSR cacheável.
- Load balancer: desnecessário em ~1k usuários esporádicos numa VM; obrigatório
  para HA em ~100k com tráfego constante.

Responda APENAS JSON válido no schema pedido. Sem markdown.
""".strip()
