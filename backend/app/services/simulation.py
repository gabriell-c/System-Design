"""Simulação determinística de carga, jornada e eventos sobre o grafo desenhado.

Não dispara HTTP real: estima RPS/latência/falha a partir das heurísticas do catálogo
(THROUGHPUT_RPS, cache, LB, DB) + seed para reprodutibilidade.
"""

from __future__ import annotations

import csv
import io
import math
import random

from app.schemas.simulation import (
    Bottleneck,
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
from app.services.knowledge import POSTGRES_PRACTICAL_ON_T3_MEDIUM, THROUGHPUT_RPS

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


def estimate_capacity_rps(nodes: list[dict], edges: list[dict]) -> tuple[float, list[Bottleneck]]:
    techs = _techs(nodes)
    backends = [t for t in techs if t in THROUGHPUT_RPS]
    bottlenecks: list[Bottleneck] = []

    if backends:
        caps = [THROUGHPUT_RPS[b]["high"] for b in backends]
        backend_cap = float(min(caps))
        primary = backends[caps.index(int(backend_cap))] if caps else backends[0]
    else:
        backend_cap = 120.0
        primary = "generic-api"
        bottlenecks.append(
            Bottleneck(
                component="backend",
                reason="Sem framework de backend reconhecido — capacidade conservadora.",
                severity="warning",
                saturation_pct=100.0,
            )
        )

    has_lb = _has(techs, "Load Balancer", "ALB")
    has_cache = _has(techs, "Redis", "ElastiCache")
    has_cdn = _has(techs, "CloudFront")
    has_pg = _has(techs, "PostgreSQL", "RDS")
    has_lambda = _has(techs, "Lambda")
    replicas = max(1, sum(1 for t in techs if t in THROUGHPUT_RPS))

    capacity = backend_cap * (1.6 if has_lb else 1.0) * replicas
    if has_cache:
        capacity *= 1.35
    if has_cdn:
        capacity *= 1.15
    if has_lambda and not has_lb:
        capacity = min(capacity, 400.0)
        bottlenecks.append(
            Bottleneck(
                component="Lambda",
                reason="Lambda sem LB/concurrency explícita satura cedo em tráfego constante.",
                severity="warning",
                saturation_pct=70.0,
            )
        )

    if has_pg:
        db_cap = float(POSTGRES_PRACTICAL_ON_T3_MEDIUM * (8 if has_cache else 3))
        if db_cap < capacity:
            bottlenecks.append(
                Bottleneck(
                    component="PostgreSQL",
                    reason=(
                        f"DB ~{int(db_cap)} RPS práticos "
                        f"({'com cache' if has_cache else 'sem pooler/cache'}) vs app ~{int(capacity)}."
                    ),
                    severity="critical" if db_cap < capacity * 0.6 else "warning",
                    saturation_pct=round(100 * capacity / max(db_cap, 1), 1),
                )
            )
            capacity = db_cap

    if not has_lb and capacity > 800:
        bottlenecks.append(
            Bottleneck(
                component="single-instance",
                reason="Capacidade alta sem load balancer — SPOF sob pico.",
                severity="warning",
                saturation_pct=85.0,
            )
        )

    # edges densos sugerem fan-out / chatty APIs
    if len(edges) > max(4, len(nodes) * 2):
        capacity *= 0.85
        bottlenecks.append(
            Bottleneck(
                component="mesh",
                reason="Muitas conexões no grafo — risco de chatter e latência composta.",
                severity="info",
                saturation_pct=60.0,
            )
        )

    if backends:
        nid = next(
            (
                str(n.get("id"))
                for n in nodes
                if (_node_data(n).get("config") or {}).get("framework") == primary
                or _node_data(n).get("kind") == "backend"
            ),
            None,
        )
        if not any(b.component == primary for b in bottlenecks):
            bottlenecks.insert(
                0,
                Bottleneck(
                    node_id=nid,
                    component=primary,
                    reason=f"Teto heurístico do {primary}: ~{int(backend_cap)} RPS/instância.",
                    severity="info",
                    saturation_pct=100.0,
                ),
            )

    return round(max(capacity, 20.0), 1), bottlenecks


def _noise(rng: random.Random, realism: float, base: float, pct: float = 0.08) -> float:
    if realism <= 0:
        return base
    amp = pct * (0.3 + 1.4 * realism)  # seed tem efeito visível mesmo em realism moderado
    return base * (1.0 + rng.uniform(-amp, amp))


def simulate_load(
    scenario: LoadScenario,
    capacity: float,
    bottlenecks: list[Bottleneck],
    rng: random.Random,
    realism: float,
    include_timeline: bool,
) -> LoadReport:
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
        if scenario.type == "constant":
            rps = target
        elif scenario.type == "gradual":
            rps = target * progress
        elif scenario.type == "spike":
            # pico no primeiro terço
            if progress < 0.15:
                rps = target * 0.3
            elif progress < 0.45:
                rps = target * scenario.burst_multiplier
            else:
                rps = target * 0.5
        else:  # periodic
            wave = 0.5 + 0.5 * math.sin(progress * math.pi * 4)
            rps = target * (0.4 + 0.6 * wave) * (scenario.burst_multiplier if wave > 0.85 else 1.0)

        rps = _noise(rng, realism, rps)
        load_ratio = rps / max(capacity, 1.0)
        saturated = load_ratio >= 0.95
        if saturated and sat_at is None:
            sat_at = t

        # erro sobe depois de 80% da capacidade
        base_err = 0.002
        if load_ratio > 0.8:
            base_err += (load_ratio - 0.8) ** 2 * 0.6
        if load_ratio > 1.0:
            base_err += min(0.45, (load_ratio - 1.0) * 0.35)
        if any(b.severity == "critical" for b in bottlenecks) and load_ratio > 0.7:
            base_err += 0.05
        err = min(0.95, _noise(rng, realism, base_err, 0.2))

        p95 = 40 + load_ratio * 180
        if saturated:
            p95 += 400 * (load_ratio - 0.95)
        p95 = _noise(rng, realism, p95, 0.12)

        peak = max(peak, rps)
        err_peak = max(err_peak, err)
        sum_rps += rps
        if include_timeline:
            timeline.append(
                LoadPoint(
                    t_seconds=t,
                    rps=round(rps, 1),
                    error_rate=round(err, 4),
                    p95_ms=round(p95, 1),
                    saturated=saturated,
                )
            )

    avg = sum_rps / steps
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
        drop = min(0.9, _noise(rng, realism, drop, 0.25))  # variância maior no funil
        dropped = round(entered * drop)
        completed = max(0, entered - dropped)
        latency = step.think_time_ms * (1 + 0.6 * max(0, pressure - 0.8))
        latency = _noise(rng, realism, latency, 0.1)
        success = completed / entered if entered else 0.0
        if drop >= 0.15:
            hotspots.append(step.name)
        results.append(
            JourneyStepResult(
                step_id=step.id,
                name=step.name,
                kind=step.kind,
                entered=entered,
                completed=completed,
                dropped=dropped,
                success_rate=round(success, 4),
                avg_latency_ms=round(latency, 1),
            )
        )
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
                # cada dependente rola com 0.55 base
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

        triggered.append(
            TriggeredEvent(
                event_type=pattern.event_type,
                triggered=fire,
                roll=round(roll, 4),
                cascade=cascade,
                impact=impact,
                severity=pattern.severity,
            )
        )

    fires = sum(1 for e in triggered if e.triggered)
    ok = not any(e.triggered and e.severity == "critical" for e in triggered)
    return EventReport(triggered_count=fires, events=triggered, cascade_depth=cascade_depth, ok=ok)


def compute_realism_score(
    rng: random.Random,
    realism_level: float,
    load: LoadReport | None,
    journey: JourneyReport | None,
    events: EventReport | None,
) -> float:
    """Score 0–1: quão 'plausível' o resultado é (não é acurácia de produção)."""
    score = 0.55 + 0.25 * realism_level
    if load and load.timeline:
        # variância na timeline indica ruído saudável
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
    # jitter leve mas seed-stable
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

    # defaults se usuário não passou regras
    effective = rules or [
        ValidationRule(metric="realism_score", min_value=0.5),
        ValidationRule(metric="capacity_rps", min_value=20),
    ]

    results: list[ValidationResult] = []
    for rule in effective:
        actual = metrics.get(rule.metric)
        if actual is None:
            results.append(
                ValidationResult(
                    metric=rule.metric,
                    passed=not rule.required,
                    actual=None,
                    expected_min=rule.min_value,
                    expected_max=rule.max_value,
                    detail="métrica ausente neste run",
                )
            )
            continue
        ok = True
        if rule.min_value is not None and actual < rule.min_value:
            ok = False
        if rule.max_value is not None and actual > rule.max_value:
            ok = False
        results.append(
            ValidationResult(
                metric=rule.metric,
                passed=ok,
                actual=actual,
                expected_min=rule.min_value,
                expected_max=rule.max_value,
                detail="ok" if ok else "fora da faixa",
            )
        )
    return results


def _export(result: SimulationResult, fmt: str) -> tuple[str, str]:
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["section", "key", "value"])
        writer.writerow(["meta", "seed", result.seed])
        writer.writerow(["meta", "realism_score", result.realism_score])
        writer.writerow(["meta", "capacity_rps", result.estimated_capacity_rps])
        if result.load:
            writer.writerow(["load", "peak_rps", result.load.peak_rps])
            writer.writerow(["load", "error_rate_peak", result.load.error_rate_peak])
            for point in result.load.timeline:
                writer.writerow(["timeline", f"t={point.t_seconds}", f"rps={point.rps};err={point.error_rate}"])
        if result.journey:
            writer.writerow(["journey", "conversion", result.journey.conversion_rate])
        return buf.getvalue(), "text/csv"

    if fmt == "prometheus":
        lines = [
            f'archia_sim_capacity_rps{{seed="{result.seed}"}} {result.estimated_capacity_rps}',
            f'archia_sim_realism_score{{seed="{result.seed}"}} {result.realism_score}',
        ]
        if result.load:
            lines.append(f'archia_sim_peak_rps{{seed="{result.seed}"}} {result.load.peak_rps}')
            lines.append(f'archia_sim_error_rate_peak{{seed="{result.seed}"}} {result.load.error_rate_peak}')
        if result.journey:
            lines.append(f'archia_sim_conversion_rate{{seed="{result.seed}"}} {result.journey.conversion_rate}')
        lines.append("")
        return "\n".join(lines), "text/plain; version=0.0.4"

    # json — body já é o próprio result; export opcional compacto
    return result.model_dump_json(indent=2), "application/json"


def run_simulation(req: SimulationRequest) -> SimulationResult:
    rng = random.Random(req.seed)
    capacity, bottlenecks = estimate_capacity_rps(req.nodes, req.edges)
    techs = _techs(req.nodes)
    has_cache = _has(techs, "Redis", "ElastiCache")
    has_lb = _has(techs, "Load Balancer", "ALB")

    load_report: LoadReport | None = None
    journey_report: JourneyReport | None = None
    event_report: EventReport | None = None
    findings: list[str] = []
    presets_used: list[str] = []

    load = req.load or LoadScenario()
    load_report = simulate_load(load, capacity, bottlenecks, rng, req.realism_level, req.include_timeline)
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

    if load_report.saturation_at_seconds is not None:
        findings.append(
            f"Saturação estimada em t={load_report.saturation_at_seconds}s "
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

    cost = estimate_monthly_cost(req.nodes)
    summary = (
        f"Capacidade ~{capacity} RPS · pico simulado {load_report.peak_rps} RPS · "
        f"realismo {realism:.0%} · custo heurístico ~US${cost}/mês · seed {req.seed}"
    )

    result = SimulationResult(
        seed=req.seed,
        realism_score=realism,
        reproducible=True,
        estimated_capacity_rps=capacity,
        summary=summary,
        load=load_report,
        journey=journey_report,
        events=event_report,
        validations=validations,
        validations_passed=all(v.passed for v in validations),
        findings=findings,
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
        load=preset.load,
        journey=preset.journey,
        events=preset.events,
        output_format=output_format,  # type: ignore[arg-type]
    )
