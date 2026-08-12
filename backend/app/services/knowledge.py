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
    # Deploy platforms (estimated monthly cost for small projects)
    "Vercel:Hobby": 0.0,
    "Vercel:Pro": 20.0,
    "Netlify:Starter": 0.0,
    "Netlify:Pro": 19.0,
    "Railway:Starter": 5.0,
    "Fly.io:Scale": 5.0,
    "Render:Starter": 7.0,
    "Coolify:self-hosted": 0.0,
    "Kubernetes:managed": 73.0,
    "GitHub Actions:free": 0.0,
    "Terraform:free": 0.0,
}

POSTGRES_DEFAULT_MAX_CONN = 100
POSTGRES_PRACTICAL_ON_T3_MEDIUM = 50

# Capacidade realista por componente (RPS sustentado antes de degradar).
# Estes são teto práticos de produção (não pico teórico) para instância pequena/média.
# Fonte: benchmarks públicos (TechEmpower, docs AWS, PostgreSQL wiki) — ordem de grandeza.
COMPONENT_CAPACITY_RPS = {
    # Backends (RPS/instância, antes de DB/IO ser gargalo)
    "Flask": {"rps_per_instance": 400, "max_connections": 200, "kind": "backend"},
    "Django": {"rps_per_instance": 300, "max_connections": 200, "kind": "backend"},
    "FastAPI": {"rps_per_instance": 2000, "max_connections": 500, "kind": "backend"},
    "Express": {"rps_per_instance": 5000, "max_connections": 1000, "kind": "backend"},
    "NestJS": {"rps_per_instance": 3000, "max_connections": 800, "kind": "backend"},
    "Spring Boot": {"rps_per_instance": 8000, "max_connections": 1000, "kind": "backend"},
    "Laravel": {"rps_per_instance": 500, "max_connections": 200, "kind": "backend"},
    # Bancos (RPS de leitura sustentado em instância pequena)
    "PostgreSQL": {"rps_per_instance": 150, "max_connections": 100, "kind": "database"},
    "MySQL": {"rps_per_instance": 150, "max_connections": 100, "kind": "database"},
    "MariaDB": {"rps_per_instance": 150, "max_connections": 100, "kind": "database"},
    "MongoDB": {"rps_per_instance": 500, "max_connections": 200, "kind": "database"},
    "DynamoDB": {"rps_per_instance": 5000, "max_connections": 99999, "kind": "database"},
    "Redis": {"rps_per_instance": 8000, "max_connections": 10000, "kind": "cache"},
    "ElastiCache": {"rps_per_instance": 8000, "max_connections": 10000, "kind": "cache"},
    # Cloud/Infra
    "Load Balancer": {"rps_per_instance": 50000, "max_connections": 99999, "kind": "cloud"},
    "ALB": {"rps_per_instance": 50000, "max_connections": 99999, "kind": "cloud"},
    "CloudFront": {"rps_per_instance": 100000, "max_connections": 99999, "kind": "cloud"},
    "Lambda": {"rps_per_instance": 1000, "max_connections": 1000, "kind": "cloud"},
    "ECS": {"rps_per_instance": 99999, "max_connections": 99999, "kind": "cloud"},
    "S3": {"rps_per_instance": 5500, "max_connections": 99999, "kind": "cloud"},
    "RDS": {"rps_per_instance": 150, "max_connections": 100, "kind": "cloud"},
}

# Multiplicadores de capacidade quando há padrões arquiteturais saudáveis
ARCHITECTURE_MULTIPLIERS = {
    "load_balancer": 2.5,     # distribui entre N instâncias
    "cache": 1.8,             # reduz hits no DB
    "cdn": 1.4,               # descarga de assets/SSR
    "read_replica": 2.0,      # replicas de leitura no DB
    "queue": 1.6,             # suaviza picos (descasca do caminho quente)
}

# ============================================================
# Capacidade por componente — modelo de capacidade realista
# Cada componente tem: rps_base (RPS sustentado), max_connections,
# cpu_cores (estimado), memory_gb (estimado), e limit_type.
# ============================================================

# Padrões de conexão entre componentes (quantas conexões o upstream precisa do downstream)
CONNECTION_REQUIREMENTS = {
    # (backend_kind) -> { "database": rps_per_conn, "cache": rps_per_conn, "queue": rps_per_conn }
    "FastAPI": {"database": 50, "cache": 200, "queue": 100},
    "Express": {"database": 80, "cache": 300, "queue": 150},
    "NestJS": {"database": 60, "cache": 250, "queue": 120},
    "Flask": {"database": 30, "cache": 150, "queue": 80},
    "Django": {"database": 40, "cache": 180, "queue": 90},
}

# Multiplicadores de efeito cascata quando um componente satura
CASCADE_EFFECTS = {
    "database_saturation": {"api_latency_multiplier": 2.5, "error_rate_base": 0.15},
    "cache_miss_storm": {"database_load_multiplier": 3.0, "api_latency_multiplier": 1.5},
    "queue_overflow": {"api_error_rate": 0.1, "throughput_drop": 0.4},
    "connection_exhaustion": {"success_rate_drop": 0.3, "latency_spike_ms": 5000},
}

# Limiares de degradação realistas (fração da capacidade nominal)
DEGRADATION = {
    "knee": 0.70,       # 70%: joelho da curva — latência começa a subir
    "saturation": 0.85,  # 85%: saturado — erros começam
    "critical": 1.0,     # 100%: colapso — erros altos + latência explode
}

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
    # Deploy tools
    "Docker": 2,
    "Docker Compose": 2,
    "Kubernetes": 5,
    "Coolify": 2,
    "Vercel": 2,
    "Netlify": 2,
    "Railway": 1,
    "Fly.io": 2,
    "Render": 2,
    "GitHub Actions": 2,
    "GitLab CI": 3,
    "Terraform": 4,
    "Pulumi": 3,
    "CloudFront CDN": 2,
    "Nginx": 3,
    "Traefik": 3,
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
