"""Simulação determinística de carga, jornada e eventos sobre o grafo desenhado.

Modelo de capacidade realista: calcula RPS por componente, identifica gargalos
individuais e simula efeitos cascata quando um componente satura.
"""

from __future__ import annotations

import csv
import io
import math
import random

from app.schemas.simulation import (
    Bottleneck,
    ComponentCapacity,
    EngineeringAudit,
    EventPattern,
    EventReport,
    JourneyReport,
    JourneyStep,
    JourneyStepResult,
    LoadPoint,
    LoadReport,
    LoadScenario,
    SimulationPreset,
    SimulationRequest,
    SimulationResult,
    TriggeredEvent,
    UserJourney,
    ValidationResult,
    ValidationRule,
)
from app.services.heuristic import estimate_monthly_cost
from app.services.knowledge import (
    COMPONENT_CAPACITY_RPS,
    DEGRADATION,
    POSTGRES_PRACTICAL_ON_T3_MEDIUM,
)

DEFAULT_JOURNEY_STEPS: list[JourneyStep] = [
    JourneyStep(id="land", name="Landing", kind="landing", drop_off_rate=0.08, think_time_ms=600),
    JourneyStep(id="browse", name="Explorar", kind="browse", drop_off_rate=0.12, think_time_ms=1200),
    JourneyStep(id="auth", name="Login / cadastro", kind="auth", drop_off_rate=0.18, think_time_ms=900),
    JourneyStep(id="write", name="Ação principal", kind="write", drop_off_rate=0.1, think_time_ms=700),
    JourneyStep(id="checkout", name="Checkout", kind="checkout", drop_off_rate=0.22, think_time_ms=1500),
    JourneyStep(id="pay", name="Pagamento", kind="payment", drop_off_rate=0.15, think_time_ms=1100),
    JourneyStep(id="ok", name="Confirmação", kind="confirm", drop_off_rate=0.02, think_time_ms=400),
]

PRESETS: list[SimulationPreset] = [
    SimulationPreset(
        id="black-friday-spike",
        label="Spike Black Friday",
        description="Pico 10× em 30s — testa LB, cache e DB sob burst.",
        load=LoadScenario(
            name="Black Friday",
            type="spike",
            requests_per_second=500,
            duration_seconds=90,
            burst_multiplier=10.0,
            concurrent_users=2000,
        ),
        journey=UserJourney(name="Compra promocional", steps=DEFAULT_JOURNEY_STEPS, concurrent_users=2000),
        events=[
            EventPattern(event_type="payment_gateway_timeout", trigger_probability=0.25, severity="critical", dependent_events=["retry_storm", "cart_abandon"]),
            EventPattern(event_type="cache_miss_storm", trigger_probability=0.35, severity="warning", dependent_events=["db_connection_exhaustion"]),
        ],
    ),
    SimulationPreset(
        id="steady-saas",
        label="SaaS estável",
        description="Carga constante de produto B2B — funil login → ação.",
        load=LoadScenario(
            name="Steady SaaS",
            type="constant",
            requests_per_second=80,
            duration_seconds=120,
            burst_multiplier=1.2,
            concurrent_users=200,
        ),
        journey=UserJourney(
            name="Uso diário",
            concurrent_users=200,
            steps=[
                JourneyStep(id="auth", name="Login", kind="auth", drop_off_rate=0.05),
                JourneyStep(id="read", name="Dashboard", kind="read", drop_off_rate=0.04),
                JourneyStep(id="write", name="Criar recurso", kind="write", drop_off_rate=0.08),
                JourneyStep(id="ok", name="Salvo", kind="confirm", drop_off_rate=0.01),
            ],
        ),
        events=[
            EventPattern(event_type="deploy_canary", trigger_probability=0.15, severity="info", dependent_events=["partial_error_budget"]),
        ],
    ),
    SimulationPreset(
        id="incident-cascade",
        label="Incidente em cascata",
        description="Falha de dependência + retry storm — valida resiliência.",
        load=LoadScenario(
            name="Incidente",
            type="periodic",
            requests_per_second=150,
            duration_seconds=120,
            burst_multiplier=4.0,
            concurrent_users=500,
        ),
        journey=UserJourney(name="Jornada sob incidente", steps=DEFAULT_JOURNEY_STEPS[:4], concurrent_users=500),
        events=[
            EventPattern(event_type="db_primary_failover", trigger_probability=0.55, severity="critical", dependent_events=["api_5xx_burst", "circuit_breaker_open", "queue_backlog"]),
            EventPattern(event_type="cdn_origin_shield_miss", trigger_probability=0.3, severity="warning", dependent_events=["origin_overload"]),
        ],
    ),
    SimulationPreset(
        id="gradual-ramp",
        label="Ramp gradual",
        description="Sobe RPS linearmente — acha o ponto de saturação.",
        load=LoadScenario(
            name="Ramp",
            type="gradual",
            requests_per_second=1000,
            duration_seconds=180,
            burst_multiplier=1.0,
            concurrent_users=1000,
        ),
        journey=UserJourney(name="Funil padrão", steps=DEFAULT_JOURNEY_STEPS, concurrent_users=1000),
        events=[],
    ),
]


def list_presets() -> list[SimulationPreset]:
    return PRESETS


def get_preset(preset_id: str) -> SimulationPreset | None:
    return next((p for p in PRESETS if p.id == preset_id), None)


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


def _has(techs: list[str], *names: str) -> bool:
    blob = " ".join(techs).lower()
    return any(n.lower() in blob for n in names)


def _find_tech(nodes: list[dict], *names: str) -> str | None:
    """Retorna o primeiro tech que casa com os nomes."""
    techs = _techs(nodes)
    for t in techs:
        tl = t.lower()
        for n in names:
            if n.lower() in tl:
                return t
    return None


def estimate_component_capacities(nodes: list[dict], edges: list[dict]) -> tuple[float, list[ComponentCapacity], list[Bottleneck]]:
    """Calcula capacidade de cada componente e identifica gargalos."""
    techs = _techs(nodes)
    capacities: list[ComponentCapacity] = []
    bottlenecks: list[Bottleneck] = []

    # Extrai nomes dos techs para lookup
    tech_map = {t.lower(): t for t in techs}

    # Identifica instâncias de cada tipo
    backend_tech = _find_tech(nodes, "FastAPI", "Express", "NestJS", "Flask", "Django", "Spring Boot", "Laravel")
    db_tech = _find_tech(nodes, "PostgreSQL", "MySQL", "MongoDB", "DynamoDB")
    cache_tech = _find_tech(nodes, "Redis", "ElastiCache")
    lb_tech = _find_tech(nodes, "ALB", "Load Balancer", "NGINX")
    cdn_tech = _find_tech(nodes, "CloudFront", "CDN")
    queue_tech = _find_tech(nodes, "Kafka", "RabbitMQ", "SQS", "SNS", "Pulsar", "NATS")
    lambda_tech = _find_tech(nodes, "Lambda")

    # Conta instâncias por tipo
    backend_count = sum(1 for n in nodes if _node_data(n).get("kind") == "backend") or 1
    db_count = sum(1 for n in nodes if _node_data(n).get("kind") == "database") or 1
    # cache_count not needed for capacity calculation (cache_cap derived from tech)

    # --- Backend capacity ---
    backend_cap = 120.0  # fallback genérico
    backend_conn_limit = 100
    if backend_tech:
        cap_data = COMPONENT_CAPACITY_RPS.get(backend_tech)
        if cap_data:
            backend_cap = cap_data["rps_per_instance"] * backend_count
            backend_conn_limit = cap_data["max_connections"]
        else:
            # Tenta match parcial
            for key, val in COMPONENT_CAPACITY_RPS.items():
                if key.lower() in tech_map.get(backend_tech, "").lower():
                    backend_cap = val["rps_per_instance"] * backend_count
                    backend_conn_limit = val["max_connections"]
                    break

    capacities.append(ComponentCapacity(
        component="API Backend",
        tech=backend_tech or "unknown",
        kind="backend",
        capacity_rps=backend_cap,
        max_connections=backend_conn_limit,
        utilization_pct=0.0,
    ))

    # --- Database capacity ---
    db_cap = 150.0  # fallback
    db_conn_limit = 100
    if db_tech:
        cap_data = COMPONENT_CAPACITY_RPS.get(db_tech)
        if cap_data:
            db_cap = cap_data["rps_per_instance"] * db_count
            db_conn_limit = cap_data["max_connections"]
        else:
            for key, val in COMPONENT_CAPACITY_RPS.items():
                if key.lower() in tech_map.get(db_tech, "").lower():
                    db_cap = val["rps_per_instance"] * db_count
                    db_conn_limit = val["max_connections"]
                    break

    # Ajuste para Postgres em instância pequena
    if db_tech and "postgres" in db_tech.lower():
        db_cap = POSTGRES_PRACTICAL_ON_T3_MEDIUM * db_count

    capacities.append(ComponentCapacity(
        component="Database",
        tech=db_tech or "unknown",
        kind="database",
        capacity_rps=db_cap,
        max_connections=db_conn_limit,
        utilization_pct=0.0,
    ))

    # --- Cache capacity ---
    if cache_tech:
        cap_data = COMPONENT_CAPACITY_RPS.get(cache_tech)
        cache_cap = cap_data["rps_per_instance"] if cap_data else 8000.0
        capacities.append(ComponentCapacity(
            component="Cache",
            tech=cache_tech,
            kind="cache",
            capacity_rps=cache_cap,
            max_connections=10000,
            utilization_pct=0.0,
        ))

    # --- Load Balancer capacity ---
    if lb_tech:
        capacities.append(ComponentCapacity(
            component="Load Balancer",
            tech=lb_tech,
            kind="cloud",
            capacity_rps=50000.0,
            max_connections=99999,
            utilization_pct=0.0,
        ))

    # --- CDN capacity ---
    if cdn_tech:
        capacities.append(ComponentCapacity(
            component="CDN",
            tech=cdn_tech,
            kind="cloud",
            capacity_rps=100000.0,
            max_connections=99999,
            utilization_pct=0.0,
        ))

    # --- Queue/Messaging capacity ---
    if queue_tech:
        cap_data = COMPONENT_CAPACITY_RPS.get(queue_tech)
        queue_cap = cap_data["rps_per_instance"] if cap_data else 5000.0
        capacities.append(ComponentCapacity(
            component="Message Queue",
            tech=queue_tech,
            kind="integration",
            capacity_rps=queue_cap,
            max_connections=10000,
            utilization_pct=0.0,
        ))

    # --- Lambda capacity ---
    if lambda_tech:
        capacities.append(ComponentCapacity(
            component="Lambda",
            tech=lambda_tech,
            kind="cloud",
            capacity_rps=1000.0 * backend_count,
            max_connections=1000,
            utilization_pct=0.0,
        ))

    # --- Calcula sistema capacity como mínimo dos gargalos ---
    effective_caps: list[float] = [c.capacity_rps for c in capacities if c.capacity_rps > 0]

    # Multiplicadores arquiteturais
    system_cap = min(effective_caps) if effective_caps else 120.0

    if lb_tech:
        system_cap *= 2.5
    if cache_tech:
        system_cap *= 1.8
    if cdn_tech:
        system_cap *= 1.4
    if queue_tech:
        system_cap *= 1.6
    if lambda_tech and not lb_tech:
        system_cap = min(system_cap, 400.0)

    # Deduz da capacidade do backend se DB for menor
    if db_cap < backend_cap:
        system_cap = min(system_cap, db_cap * (1.8 if cache_tech else 1.0))
        bottlenecks.append(Bottleneck(
            component=db_tech or "Database",
            reason=f"DB ~{int(db_cap)} RPS vs API ~{int(backend_cap)} RPS/inst.",
            severity="critical" if db_cap < backend_cap * 0.5 else "warning",
            saturation_pct=100 * backend_cap / max(db_cap, 1),
        ))

    # Verifica se backend satura antes do DB
    if backend_cap < system_cap * 0.8 and not lb_tech:
        bottlenecks.append(Bottleneck(
            component=backend_tech or "Backend",
            reason=f"Backend ~{int(backend_cap)} RPS/instância sem LB — SPOF sob pico.",
            severity="warning",
            saturation_pct=100,
        ))

    # Verifica conexões do DB
    if db_conn_limit > 0 and backend_count > 0:
        estimated_conns = backend_count * 10  # ~10 conns por worker
        if estimated_conns > db_conn_limit:
            bottlenecks.append(Bottleneck(
                component=db_tech or "Database",
                reason=f"Conexões estimadas ({estimated_conns}) excedem max_connections ({db_conn_limit}). Use connection pooler (PgBouncer).",
                severity="critical",
                saturation_pct=100 * estimated_conns / db_conn_limit,
            ))

    return system_cap, capacities, bottlenecks


def simulate_load(
    scenario: LoadScenario,
    capacity: float,
    bottlenecks: list[Bottleneck],
    component_caps: list[ComponentCapacity],
    rng: random.Random,
    realism: float,
    include_timeline: bool,
    test_mode: str = "load",
) -> LoadReport:
    """Simula carga com comportamento realista baseado em test_mode.

    - load: carga normal, testa capacidade sustentável
    - stress: pico progressivo até saturação
    - soak: carga sustentada por tempo prolongado
    """
    duration = scenario.duration_seconds
    target = float(scenario.requests_per_second)
    timeline: list[LoadPoint] = []
    peak = 0.0
    err_peak = 0.0
    sat_at: int | None = None
    sum_rps = 0.0

    steps = max(1, min(duration, 60 if include_timeline else 12))
    step_s = duration / steps

    for i in range(steps):
        t = round((i + 1) * step_s)
        progress = (i + 1) / steps

        # Padrão de carga baseado no test_mode
        if scenario.type == "constant":
            rps = target
        elif scenario.type == "gradual":
            rps = target * progress
        elif scenario.type == "spike":
            if progress < 0.15:
                rps = target * 0.3
            elif progress < 0.45:
                rps = target * scenario.burst_multiplier
            else:
                rps = target * 0.5
        else:  # periodic
            wave = 0.5 + 0.5 * math.sin(progress * math.pi * 4)
            rps = target * (0.4 + 0.6 * wave) * (scenario.burst_multiplier if wave > 0.85 else 1.0)

        # Ajustes por test_mode
        if test_mode == "stress":
            # Stress test: sempre aumenta, vai além da capacidade
            stress_factor = 1.0 + progress * 2.0  # até 3x o target
            rps = target * stress_factor
        elif test_mode == "soak":
            # Soak test: carga constante por tempo prolongado
            rps = target * 0.8  # 80% do target para teste de longo prazo

        rps = _noise(rng, realism, rps)
        load_ratio = rps / max(capacity, 1.0)
        saturated = load_ratio >= DEGRADATION["saturation"]
        if saturated and sat_at is None:
            sat_at = t

        # Modelo de erro realista baseado em degradação por componente
        base_err = 0.002
        critical_bottlenecks = [b for b in bottlenecks if b.severity == "critical"]

        # Erro sobe de forma não-linear após 70% da capacidade
        if load_ratio > DEGRADATION["knee"]:
            knee_factor = (load_ratio - DEGRADATION["knee"]) / (1.0 - DEGRADATION["knee"])
            base_err += knee_factor ** 2 * 0.3

        if load_ratio > 1.0:
            overflow = load_ratio - 1.0
            base_err += min(0.5, overflow * 0.4)

        # Efeito cascata de gargalos críticos
        if critical_bottlenecks and load_ratio > 0.7:
            cascade_mult = min(2.0, 1.0 + len(critical_bottlenecks) * 0.3)
            base_err *= cascade_mult

        # Erro base por saturação de componentes
        for cap in component_caps:
            if cap.capacity_rps > 0:
                cap_ratio = rps / cap.capacity_rps
                if cap_ratio > DEGRADATION["saturation"]:
                    cap_err = (cap_ratio - DEGRADATION["saturation"]) * 0.1
                    base_err = min(0.95, base_err + cap_err)

        err = min(0.95, _noise(rng, realism, base_err, 0.15))

        # Latência P95 realista
        p95 = 40 + load_ratio * 200
        if load_ratio > DEGRADATION["knee"]:
            p95 += 300 * (load_ratio - DEGRADATION["knee"])
        if saturated:
            p95 += 500 * (load_ratio - 0.95)
        p95 = _noise(rng, realism, p95, 0.1)

        peak = max(peak, rps)
        err_peak = max(err_peak, err)
        sum_rps += rps

        if include_timeline:
            timeline.append(LoadPoint(
                t_seconds=t,
                rps=round(rps, 1),
                error_rate=round(err, 4),
                p95_ms=round(p95, 1),
                saturated=saturated,
            ))

    avg = sum_rps / steps if steps > 0 else 0

    # Critério de sucesso por test_mode
    if test_mode == "load":
        ok = sat_at is None and err_peak < 0.05
    elif test_mode == "stress":
        # Stress test: ok se suportou pelo menos 1.5x a capacidade
        ok = peak < capacity * 1.5 and err_peak < 0.3
    elif test_mode == "soak":
        # Soak test: ok se não saturou em 80% do tempo
        ok = sat_at is None or sat_at > duration * 0.8 and err_peak < 0.1
    else:
        ok = sat_at is None and err_peak < 0.05

    return LoadReport(
        scenario_name=scenario.name,
        type=scenario.type,
        peak_rps=round(peak, 1),
        avg_rps=round(avg, 1),
        estimated_capacity_rps=capacity,
        saturation_at_seconds=sat_at,
        error_rate_peak=round(err_peak, 4),
        bottlenecks=bottlenecks,
        timeline=timeline,
        ok=ok,
    )


def simulate_journey(
    journey: UserJourney,
    capacity: float,
    load_peak: float,
    rng: random.Random,
    realism: float,
) -> JourneyReport:
    steps = journey.steps or DEFAULT_JOURNEY_STEPS
    pressure = min(2.5, load_peak / max(capacity, 1.0))
    entered = journey.concurrent_users
    results: list[JourneyStepResult] = []
    hotspots: list[str] = []

    for step in steps:
        # drop sobe com pressão e tipo sensível (payment/auth)
        sens = 1.4 if step.kind in {"payment", "auth", "checkout"} else 1.0
        drop = min(0.9, step.drop_off_rate * sens * (0.7 + 0.5 * pressure))
        drop = min(0.9, _noise(rng, realism, drop, 0.25))
        dropped = round(entered * drop)
        completed = max(0, entered - dropped)
        latency = step.think_time_ms * (1 + 0.6 * max(0, pressure - 0.8))
        latency = _noise(rng, realism, latency, 0.1)
        success = completed / entered if entered else 0.0
        if drop >= 0.15:
            hotspots.append(step.name)
        results.append(JourneyStepResult(
            step_id=step.id,
            name=step.name,
            kind=step.kind,
            entered=entered,
            completed=completed,
            dropped=dropped,
            success_rate=round(success, 4),
            avg_latency_ms=round(latency, 1),
        ))
        entered = completed

    start = journey.concurrent_users or 1
    conversion = (entered / start) if start else 0.0
    ok = conversion >= 0.25 and pressure < 1.2
    return JourneyReport(
        journey_name=journey.name,
        concurrent_users=journey.concurrent_users,
        conversion_rate=round(conversion, 4),
        steps=results,
        drop_off_hotspots=hotspots[:5],
        ok=ok,
    )


def simulate_events(
    patterns: list[EventPattern],
    pressure: float,
    rng: random.Random,
    has_cache: bool,
    has_lb: bool,
) -> EventReport:
    triggered: list[TriggeredEvent] = []
    cascade_depth = 0

    for pattern in patterns:
        # pressão aumenta chance
        prob = min(1.0, pattern.trigger_probability * (0.8 + 0.5 * pressure))
        if "cache" in pattern.event_type and not has_cache:
            prob = min(1.0, prob * 1.4)
        if "db" in pattern.event_type and pressure > 1.0:
            prob = min(1.0, prob * 1.25)
        roll = rng.random()
        fire = roll < prob
        cascade: list[str] = []
        if fire and pattern.cascade_enabled:
            for dep in pattern.dependent_events:
                dep_prob = 0.55 if has_lb or has_cache else 0.75
                if rng.random() < dep_prob:
                    cascade.append(dep)
            cascade_depth = max(cascade_depth, len(cascade))

        impact = "sem impacto"
        if fire:
            if pattern.severity == "critical":
                impact = "erro elevado + latência; possível circuito aberto"
            elif pattern.severity == "warning":
                impact = "degradação parcial / retry"
            else:
                impact = "ruído observável, orçamento de erro"

        triggered.append(TriggeredEvent(
            event_type=pattern.event_type,
            triggered=fire,
            roll=round(roll, 4),
            cascade=cascade,
            impact=impact,
            severity=pattern.severity,
        ))

    fires = sum(1 for e in triggered if e.triggered)
    ok = not any(e.triggered and e.severity == "critical" for e in triggered)
    return EventReport(triggered_count=fires, events=triggered, cascade_depth=cascade_depth, ok=ok)


def build_engineering_audit(
    nodes: list[dict],
    edges: list[dict],
    capacity: float,
    component_caps: list[ComponentCapacity],
    bottlenecks: list[Bottleneck],
    peak_rps: float,
) -> EngineeringAudit:
    """Constrói análise de engenharia detalhada."""
    techs = _techs(nodes)
    has_cache = _has(techs, "Redis", "ElastiCache")
    has_lb = _has(techs, "ALB", "Load Balancer")
    has_queue = _has(techs, "Kafka", "RabbitMQ", "SQS", "Pulsar", "NATS")

    # Identifica gargalo principal
    bottleneck_comp = None
    bottleneck_rps = float("inf")
    for comp in component_caps:
        if comp.capacity_rps < bottleneck_rps and comp.capacity_rps > 0:
            bottleneck_rps = comp.capacity_rps
            bottleneck_comp = comp

    headroom = ((capacity - peak_rps) / max(capacity, 1)) * 100

    # Cenários de falha
    failure_scenarios: list[str] = []
    recommendations: list[str] = []

    if bottleneck_comp:
        utilization = (peak_rps / max(bottleneck_comp.capacity_rps, 1)) * 100
        if utilization > 100:
            failure_scenarios.append(
                f"❌ **{bottleneck_comp.tech}** satura em ~{int(bottleneck_comp.capacity_rps)} RPS. "
                f"Com {int(peak_rps)} RPS de pico, há {int(utilization - 100)}% de overload."
            )
            recommendations.append(f"Adicione mais instâncias de {bottleneck_comp.tech} ou migre para versão maior.")
        elif utilization > 80:
            failure_scenarios.append(
                f"⚠️ **{bottleneck_comp.tech}** opera em ~{int(utilization)}% da capacidade. "
                f"Margem pequena para picos."
            )
            recommendations.append(f"Considere escalar {bottleneck_comp.tech} verticalmente ou adicionar redundância.")

    # Análise de connection pooling
    db_cap = next((c for c in component_caps if c.kind == "database"), None)
    if db_cap and db_cap.max_connections > 0:
        backend_cap = next((c for c in component_caps if c.kind == "backend"), None)
        if backend_cap:
            est_conns = int(peak_rps / max(db_cap.capacity_rps, 1) * 10)
            if est_conns > db_cap.max_connections * 0.8:
                failure_scenarios.append(
                    f"⚠️ Conexões estimadas (~{est_conns}) aproximam-se do limite de {db_cap.max_connections} conexões do {db_cap.tech}."
                )
                recommendations.append("Configure PgBouncer/Connection Pooler para reutilizar conexões.")

    # Análise de cache
    if not has_cache and peak_rps > 200:
        failure_scenarios.append("⚠️ Sem cache sob carga moderada/alta — DB será sobrecarregado.")
        recommendations.append("Adicione Redis/ElastiCache para cache de leitura e sessões.")

    # Análise de load balancer
    if not has_lb and peak_rps > 500:
        failure_scenarios.append("⚠️ Sem LB sob carga alta — risco de SPOF em instância única.")
        recommendations.append("Adicione Load Balancer para distribuição e health checks.")

    # Análise de fila
    if _has(techs, "fastapi") or _has(techs, "express") or _has(techs, "nest"):
        if not has_queue and peak_rps > 300:
            failure_scenarios.append("⚠️ Sem fila assíncrona — operations longas bloqueiam requests.")
            recommendations.append("Considere SQS/Kafka/RabbitMQ para operações assíncronas.")

    return EngineeringAudit(
        bottleneck_component=bottleneck_comp.component if bottleneck_comp else None,
        bottleneck_tech=bottleneck_comp.tech if bottleneck_comp else None,
        bottleneck_rps=bottleneck_rps if bottleneck_comp else 0.0,
        system_capacity_rps=capacity,
        headroom_pct=round(max(0, headroom), 1),
        component_capacities=component_caps,
        failure_scenarios=failure_scenarios,
        recommendations=recommendations,
    )


def compute_realism_score(
    rng: random.Random,
    realism_level: float,
    load: LoadReport | None,
    journey: JourneyReport | None,
    events: EventReport | None,
) -> float:
    score = 0.55 + 0.25 * realism_level
    if load and load.timeline:
        rps_vals = [p.rps for p in load.timeline]
        if len(rps_vals) >= 2:
            mean = sum(rps_vals) / len(rps_vals)
            var = sum((x - mean) ** 2 for x in rps_vals) / len(rps_vals)
            cv = math.sqrt(var) / max(mean, 1)
            if 0.02 <= cv <= 0.45:
                score += 0.08
            elif cv > 0.8:
                score -= 0.05
    if journey and 0.05 <= journey.conversion_rate <= 0.85:
        score += 0.07
    if events is not None:
        score += 0.05
    score += rng.uniform(-0.02, 0.02) * realism_level
    return round(min(0.99, max(0.2, score)), 3)


def run_validations(
    rules: list[ValidationRule],
    capacity: float,
    load: LoadReport | None,
    journey: JourneyReport | None,
    realism: float,
) -> list[ValidationResult]:
    metrics: dict[str, float] = {
        "capacity_rps": capacity,
        "realism_score": realism,
    }
    if load:
        metrics["peak_rps"] = load.peak_rps
        metrics["error_rate_peak"] = load.error_rate_peak
        metrics["avg_rps"] = load.avg_rps
    if journey:
        metrics["conversion_rate"] = journey.conversion_rate

    effective = rules or [
        ValidationRule(metric="realism_score", min_value=0.5),
        ValidationRule(metric="capacity_rps", min_value=20),
    ]

    results: list[ValidationResult] = []
    for rule in effective:
        actual = metrics.get(rule.metric)
        if actual is None:
            results.append(ValidationResult(
                metric=rule.metric,
                passed=not rule.required,
                actual=None,
                expected_min=rule.min_value,
                expected_max=rule.max_value,
                detail="métrica ausente neste run",
            ))
            continue
        ok = True
        if rule.min_value is not None and actual < rule.min_value:
            ok = False
        if rule.max_value is not None and actual > rule.max_value:
            ok = False
        results.append(ValidationResult(
            metric=rule.metric,
            passed=ok,
            actual=actual,
            expected_min=rule.min_value,
            expected_max=rule.max_value,
            detail="ok" if ok else "fora da faixa",
        ))
    return results


def _export(result: SimulationResult, fmt: str) -> tuple[str, str]:
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["section", "key", "value"])
        writer.writerow(["meta", "seed", result.seed])
        writer.writerow(["meta", "test_mode", result.test_mode])
        writer.writerow(["meta", "realism_score", result.realism_score])
        writer.writerow(["meta", "capacity_rps", result.estimated_capacity_rps])
        if result.load:
            writer.writerow(["load", "peak_rps", result.load.peak_rps])
            writer.writerow(["load", "error_rate_peak", result.load.error_rate_peak])
            for point in result.load.timeline:
                writer.writerow(["timeline", f"t={point.t_seconds}", f"rps={point.rps};err={point.error_rate}"])
        if result.journey:
            writer.writerow(["journey", "conversion", result.journey.conversion_rate  ])
        if result.engineering_audit:
            audit = result.engineering_audit
            writer.writerow(["audit", "bottleneck", audit.bottleneck_tech or "none"])
            writer.writerow(["audit", "bottleneck_rps", audit.bottleneck_rps])
            writer.writerow(["audit", "headroom_pct", audit.headroom_pct])
        return buf.getvalue(), "text/csv"

    if fmt == "prometheus":
        lines = [
            f'archia_sim_capacity_rps{{seed="{result.seed}",mode="{result.test_mode}"}} {result.estimated_capacity_rps}',
            f'archia_sim_realism_score{{seed="{result.seed}"}} {result.realism_score}',
        ]
        if result.load:
            lines.append(f'archia_sim_peak_rps{{seed="{result.seed}"}} {result.load.peak_rps}')
            lines.append(f'archia_sim_error_rate_peak{{seed="{result.seed}"}} {result.load.error_rate_peak}')
        if result.journey:
            lines.append(f'archia_sim_conversion_rate{{seed="{result.seed}"}} {result.journey.conversion_rate}')
        if result.engineering_audit:
            lines.append(f'archia_sim_bottleneck_rps{{seed="{result.seed}"}} {result.engineering_audit.bottleneck_rps}')
            lines.append(f'archia_sim_headroom_pct{{seed="{result.seed}"}} {result.engineering_audit.headroom_pct}')
        lines.append("")
        return "\n".join(lines), "text/plain; version=0.0.4"

    return result.model_dump_json(indent=2), "application/json"


def _noise(rng: random.Random, realism: float, base: float, pct: float = 0.08) -> float:
    if realism <= 0:
        return base
    amp = pct * (0.3 + 1.4 * realism)
    return base * (1.0 + rng.uniform(-amp, amp))


def run_simulation(req: SimulationRequest) -> SimulationResult:
    rng = random.Random(req.seed)
    capacity, component_caps, bottlenecks = estimate_component_capacities(req.nodes, req.edges)
    techs = _techs(req.nodes)
    has_cache = _has(techs, "Redis", "ElastiCache")
    has_lb = _has(techs, "ALB", "Load Balancer")

    load_report: LoadReport | None = None
    journey_report: JourneyReport | None = None
    event_report: EventReport | None = None
    findings: list[str] = []
    presets_used: list[str] = []

    load = req.load or LoadScenario()
    load_report = simulate_load(
        load, capacity, bottlenecks, component_caps,
        rng, req.realism_level, req.include_timeline,
        test_mode=req.test_mode,
    )
    peak = load_report.peak_rps
    pressure = peak / max(capacity, 1.0)

    journey = req.journey or UserJourney(steps=DEFAULT_JOURNEY_STEPS)
    journey_report = simulate_journey(journey, capacity, peak, rng, req.realism_level)

    if req.events:
        event_report = simulate_events(req.events, pressure, rng, has_cache, has_lb)
    else:
        event_report = EventReport(triggered_count=0, events=[], cascade_depth=0, ok=True)

    realism = compute_realism_score(rng, req.realism_level, load_report, journey_report, event_report)
    validations = run_validations(req.validation_rules, capacity, load_report, journey_report, realism)

    # Engineering audit
    audit = build_engineering_audit(req.nodes, req.edges, capacity, component_caps, bottlenecks, peak)

    # Findings
    if load_report.saturation_at_seconds is not None:
        findings.append(
            f"Saturação em t={load_report.saturation_at_seconds}s "
            f"(pico {load_report.peak_rps} RPS vs capacidade {capacity})."
        )
    if journey_report and journey_report.drop_off_hotspots:
        findings.append("Drop-off alto em: " + ", ".join(journey_report.drop_off_hotspots))
    if event_report and event_report.triggered_count:
        crit = [e.event_type for e in event_report.events if e.triggered and e.severity == "critical"]
        if crit:
            findings.append("Eventos críticos disparados: " + ", ".join(crit))
    if not has_cache and pressure > 0.8:
        findings.append("Sem cache sob pressão — DB tende a ser o primeiro a cair.")
    if not has_lb and load.type == "spike":
        findings.append("Spike sem load balancer — instância única é SPOF.")

    # Test mode specific findings
    if req.test_mode == "stress" and not load_report.ok:
        findings.append(f"Teste de stress: arquitetura falhou em ~{int(peak)} RPS (capacidade: {int(capacity)}).")
    elif req.test_mode == "load" and load_report.ok:
        findings.append(f"Teste de load: arquitetura suporta {int(peak)} RPS com margem de {audit.headroom_pct}%.")

    cost = estimate_monthly_cost(req.nodes)
    mode_label = {"load": "Load", "stress": "Stress", "soak": "Soak"}.get(req.test_mode, "Load")
    summary = (
        f"[{mode_label}] Capacidade ~{capacity} RPS · pico simulado {load_report.peak_rps} RPS "
        f"· margem {audit.headroom_pct:.0f}% · realismo {realism:.0%} "
        f"· custo ~US${cost}/mês · seed {req.seed}"
    )

    result = SimulationResult(
        seed=req.seed,
        realism_score=realism,
        reproducible=True,
        estimated_capacity_rps=capacity,
        test_mode=req.test_mode,
        summary=summary,
        load=load_report,
        journey=journey_report,
        events=event_report,
        validations=validations,
        validations_passed=all(v.passed for v in validations),
        findings=findings,
        engineering_audit=audit,
        presets_used=presets_used,
    )

    if req.output_format != "json":
        body, ctype = _export(result, req.output_format)
        result.export_body = body
        result.export_content_type = ctype
    return result


def build_request_from_preset(
    preset_id: str,
    nodes: list[dict],
    edges: list[dict],
    *,
    seed: int = 42,
    realism_level: float = 0.65,
    context: str = "",
    output_format: str = "json",
    test_mode: str = "load",
) -> SimulationRequest:
    preset = get_preset(preset_id)
    if not preset:
        raise ValueError(f"Preset desconhecido: {preset_id}")
    return SimulationRequest(
        name=preset.label,
        context=context,
        nodes=nodes,
        edges=edges,
        seed=seed,
        realism_level=realism_level,
        test_mode=test_mode,
        load=preset.load,
        journey=preset.journey,
        events=preset.events,
        output_format=output_format,  # type: ignore[arg-type]
    )
