"""Simulação determinística de carga, jornada e eventos sobre o grafo desenhado.

Modelo de capacidade realista: calcula RPS por componente, identifica gargalos
individuais e simula efeitos cascata quando um componente satura.

Decisões de projeto (S1a):
- Multiplicadores de arquitetura (LB/cache/CDN/fila) só são creditados quando
  o componente está conectado a outro card por pelo menos 1 aresta real —
  componente isolado não infla a capacidade do sistema.
- As comparações de gargalo usam a base crua (RPS por instância); os
  multiplicadores apenas dimensionam a capacidade efetiva do sistema.
- Componentes só são anexados quando o tech está de fato presente no grafo
  (DB ausente não gera "Database tech=unknown" fantasma).
- `presets_used` e `reproducible` não são preenchidos aqui: o engine não
  conhece presets (a rota run-preset enriquece) e todo o RNG deriva de
  `req.seed` (int, default 42, nunca None), então o default do schema vale.
- `req.context`, quando não vazio, aparece nas findings e no texto do summary.
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
    OutputFormat,
    SimulationPreset,
    SimulationRequest,
    SimulationResult,
    TestMode,
    TriggeredEvent,
    UserJourney,
    ValidationResult,
    ValidationRule,
)
from app.services.heuristic import estimate_monthly_cost
from app.services.knowledge import (
    ARCHITECTURE_MULTIPLIERS,
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


# ── Fallbacks de capacidade (ordem de grandeza; fonte: COMPONENT_CAPACITY_RPS) ──
DEFAULT_BACKEND_CAP_RPS = 120.0  # tech de backend desconhecido
DEFAULT_DB_CAP_RPS = 150.0  # tech de banco desconhecido
DEFAULT_CACHE_CAP_RPS = 8000.0
DEFAULT_QUEUE_CAP_RPS = 5000.0
CLOUD_LB_CAP_RPS = 50000.0
CDN_CAP_RPS = 100000.0
LAMBDA_CAP_PER_BACKEND = 1000.0  # Lambda provisionada por instância de backend
LAMBDA_SYSTEM_CAP_FLOOR = 400.0  # teto de sistema com Lambda sem LB
DEFAULT_CONN_LIMIT = 100  # limite de conexões padrão (backend/DB)
DEFAULT_CACHE_CONNS = 10000
DEFAULT_QUEUE_CONNS = 10000
CLOUD_CONNS = 99999
LAMBDA_CONNS = 1000
CONNS_PER_WORKER = 10  # ~10 conexões de banco por worker de backend

# ── Latência p95 (ms) ──
P95_BASE_MS = 40.0  # latência de piso (carga nula)
P95_LOAD_SLOPE_MS = 200.0  # subida linear com load_ratio
P95_KNEE_SLOPE_MS = 300.0  # subida extra após DEGRADATION["knee"]
P95_SAT_SLOPE_MS = 500.0  # subida extra após o limiar de saturação do p95
P95_SAT_RATIO = 0.95  # limiar do termo extra de p95 (acima de DEGRADATION["saturation"]=0.85)

# ── Modelo de erro ──
ERR_BASE = 0.002
ERR_KNEE_SLOPE = 0.3  # erro quadrático após o joelho
ERR_OVERFLOW_SLOPE = 0.4
ERR_OVERFLOW_CAP = 0.5
ERR_CAP = 0.95
COMP_SAT_ERR_SLOPE = 0.1  # erro por ponto de componente saturado
CASCADE_STEP = 0.3  # multiplicador de erro por gargalo crítico
CASCADE_MULT_MAX = 2.0

# ── Critérios de sucesso por test_mode ──
LOAD_ERR_MAX = 0.05
STRESS_OK_PEAK_RATIO = 1.5  # stress "ok" se aguentou 1.5× a capacidade
STRESS_ERR_MAX = 0.30
SOAK_ERR_MAX = 0.10  # teto de erro pico em soak
SOAK_LATE_SAT_RATIO = 0.80  # saturação só conta como "tardia" após 80% do tempo
SOAK_LOAD_RATIO = 0.80  # soak roda em 80% do target

# ── Ruído ──
NOISE_AMP_MAX = 0.15  # teto absoluto da amplitude do jitter (sem ruído dominante)
NOISE_BASE = 0.3
NOISE_REALISM_SLOPE = 1.4
RPS_NOISE_PCT = 0.08
ERR_NOISE_PCT = 0.15
P95_NOISE_PCT = 0.10
LATENCY_NOISE_PCT = 0.10

# ── Jornada ──
SENSITIVE_STEP_KINDS = frozenset({"payment", "auth", "checkout"})
SENSITIVE_DROP_BOOST = 1.4
DROP_BASE = 0.7
DROP_PRESSURE_SLOPE = 0.5
DROP_NOISE_PCT = 0.25
LATENCY_PRESSURE_SLOPE = 0.6
LATENCY_PRESSURE_OFFSET = 0.8
HOTSPOT_DROP_THRESHOLD = 0.15
JOURNEY_OK_CONVERSION = 0.25
JOURNEY_OK_PRESSURE = 1.2

# ── Eventos ──
EVENT_BASE_FACTOR = 0.8
EVENT_PRESSURE_FACTOR = 0.5
DEP_PROB_PROTECTED = 0.55  # dependente dispara com prob maior quando há LB/cache
DEP_PROB_BARE = 0.75
CACHE_EVENT_BOOST = 1.4
DB_EVENT_BOOST = 1.25
DB_BOOST_PRESSURE = 1.0
# Allowlist explícita: só estes event_types recebem boost. Tipos desconhecidos
# não recebem boost nenhum, e cada evento recebe no máximo 1 boost — o bug de
# dupla-fogueia por substring (ex.: "cached_db_flush" casando com "cache" e
# "db") ficou resolvido.
CACHE_EVENT_TYPES = frozenset(
    {"cache_miss_storm", "cache_invalidation_storm", "cache_eviction_storm"}
)
DB_EVENT_TYPES = frozenset(
    {"db_connection_exhaustion", "db_primary_failover", "db_deadlock", "db_replica_lag"}
)

# ── Curvas de carga ──
SPIKE_RAMP_END = 0.15
SPIKE_PEAK_END = 0.45
SPIKE_PRE_RPS = 0.3
SPIKE_POST_RPS = 0.5
PERIODIC_BASE = 0.4
PERIODIC_WAVE = 0.6
PERIODIC_BURST_WAVE = 0.85
PERIODIC_CYCLES = 4

# ── Audit heurístico (ordem de grandeza, sem benchmark específico) ──
CACHE_RECOMMEND_RPS = 200
LB_RECOMMEND_RPS = 500
QUEUE_RECOMMEND_RPS = 300
DB_CONN_HEADROOM = 0.8  # alerta quando conexões > 80% do limite
AUDIT_UTIL_CRITICAL_PCT = 100
AUDIT_UTIL_WARN_PCT = 80
DB_CRITICAL_RATIO = 0.5  # DB < 50% do backend → crítico
SPOF_BACKEND_RATIO = 0.8  # backend < 80% do gargalo mais apertado e sem LB → SPOF

# ── Timeline ──
TIMELINE_MAX_STEPS = 60
SUMMARY_MAX_STEPS = 12


def list_presets() -> list[SimulationPreset]:
    return PRESETS


def get_preset(preset_id: str) -> SimulationPreset | None:
    return next((p for p in PRESETS if p.id == preset_id), None)


def _node_data(node: dict) -> dict:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _techs(nodes: list[dict]) -> list[str]:
    """Coleta os techs dos nós, deduplicados preservando a 1ª ocorrência."""
    techs: list[str] = []
    for node in nodes:
        data = _node_data(node)
        config = data.get("config") or {}
        for key in ("framework", "engine", "service", "tech"):
            value = config.get(key) or data.get(key)
            if isinstance(value, str) and value:
                techs.append(value)
    return list(dict.fromkeys(techs))


def _has(techs: list[str], *names: str) -> bool:
    blob = " ".join(techs).lower()
    return any(n.lower() in blob for n in names)


def _find_tech(nodes: list[dict], *names: str) -> tuple[str, str | None] | None:
    """Retorna (tech, node_id) do primeiro nó cujo tech casa com algum nome."""
    for node in nodes:
        for tech in _techs([node]):
            lowered = tech.lower()
            if any(n.lower() in lowered for n in names):
                node_id = node.get("id")
                return tech, (node_id if isinstance(node_id, str) and node_id else None)
    return None


def _names_by_kind(kind: str) -> tuple[str, ...]:
    """Chaves da tabela de capacidade por `kind` — busca derivada da tabela
    (MariaDB etc. não caem no fallback por estarem fora de lista estreita)."""
    return tuple(key for key, meta in COMPONENT_CAPACITY_RPS.items() if meta["kind"] == kind)


# Backends/bancos/cache derivados da tabela; fila, LB e CDN ficam explícitos
# (Kafka/RabbitMQ/SQS/SNS/Pulsar/NATS não estão em COMPONENT_CAPACITY_RPS).
BACKEND_TECH_NAMES = _names_by_kind("backend")
DB_TECH_NAMES = _names_by_kind("database")
CACHE_TECH_NAMES = _names_by_kind("cache")
LB_TECH_NAMES = ("ALB", "Load Balancer", "NGINX")
CDN_TECH_NAMES = ("CloudFront", "CDN")
QUEUE_TECH_NAMES = ("Kafka", "RabbitMQ", "SQS", "SNS", "Pulsar", "NATS")
LAMBDA_TECH_NAMES = ("Lambda",)

# Lookup case-insensitive construído UMA vez (match exato antes do prefixo).
_CAPACITY_LOOKUP: dict[str, dict] = {
    key.lower(): meta for key, meta in COMPONENT_CAPACITY_RPS.items()
}


def _capacity_for(tech: str | None) -> dict | None:
    """Capacidade do tech na tabela, case-insensitive: exato primeiro, depois prefixo."""
    if not tech:
        return None
    lowered = tech.lower()
    if lowered in _CAPACITY_LOOKUP:
        return _CAPACITY_LOOKUP[lowered]
    for key, meta in _CAPACITY_LOOKUP.items():
        if key in lowered:
            return meta
    return None


def _linked_node_ids(edges: list[dict]) -> set[str]:
    """IDs de nós conectados a OUTROS nós por pelo menos 1 aresta (sem self-loop)."""
    linked: set[str] = set()
    for edge in edges:
        source, target = edge.get("source"), edge.get("target")
        if source and target and source != target:
            linked.add(str(source))
            linked.add(str(target))
    return linked


def _estimate_db_connections(peak_rps: float, backend_count: int) -> int:
    """Conexões de DB estimadas — modelo único (item 8).

    Máximo entre o pool de workers (`backend_count × CONNS_PER_WORKER`) e os
    requests em voo no pico (1 request ≈ 1 conexão no gargalo, ordem de
    grandeza). Quando o pico é desconhecido (fase de estimativa, `peak_rps=0`),
    o pool de workers domina.
    """
    pool = backend_count * CONNS_PER_WORKER
    return max(pool, math.ceil(peak_rps))


def estimate_component_capacities(nodes: list[dict], edges: list[dict]) -> tuple[float, list[ComponentCapacity], list[Bottleneck]]:
    """Calcula capacidade de cada componente e identifica gargalos.

    - Só anexa um ComponentCapacity quando o tech está presente no grafo
      (banco ausente não gera componente "unknown" fantasma).
    - Multiplicadores de arquitetura são creditados só se pelo menos 1 aresta
      conecta o componente a outro card (nó isolado não infla o sistema).
    - Comparações de gargalo na base crua (RPS por instância); multiplicadores
      apenas dimensionam a capacidade efetiva do sistema.
    - `utilization_pct`/`is_bottleneck` são preenchidos pelo
      `_annotate_component_utilization` (requer o pico da simulação).
    """
    capacities: list[ComponentCapacity] = []
    bottlenecks: list[Bottleneck] = []

    backend = _find_tech(nodes, *BACKEND_TECH_NAMES)
    backend_tech, backend_node_id = backend if backend else (None, None)
    db = _find_tech(nodes, *DB_TECH_NAMES)
    db_tech, db_node_id = db if db else (None, None)
    cache = _find_tech(nodes, *CACHE_TECH_NAMES)
    cache_tech, cache_node_id = cache if cache else (None, None)
    lb = _find_tech(nodes, *LB_TECH_NAMES)
    lb_tech, lb_node_id = lb if lb else (None, None)
    cdn = _find_tech(nodes, *CDN_TECH_NAMES)
    cdn_tech, cdn_node_id = cdn if cdn else (None, None)
    queue = _find_tech(nodes, *QUEUE_TECH_NAMES)
    queue_tech, queue_node_id = queue if queue else (None, None)
    lambda_found = _find_tech(nodes, *LAMBDA_TECH_NAMES)
    lambda_tech, _ = lambda_found if lambda_found else (None, None)

    backend_count = sum(1 for n in nodes if _node_data(n).get("kind") == "backend") or 1
    db_count = sum(1 for n in nodes if _node_data(n).get("kind") == "database") or 1

    linked = _linked_node_ids(edges)
    # `None in linked` é sempre False: nós sem aresta não recebem multiplicador.
    cache_linked = cache_node_id in linked
    lb_linked = lb_node_id in linked

    # --- Backend (só entra no grafo se houver tech de backend) ---
    backend_cap = DEFAULT_BACKEND_CAP_RPS * backend_count
    backend_conn_limit = DEFAULT_CONN_LIMIT
    if backend_tech:
        cap_data = _capacity_for(backend_tech)
        if cap_data:
            backend_cap = cap_data["rps_per_instance"] * backend_count
            backend_conn_limit = int(cap_data["max_connections"])
        capacities.append(ComponentCapacity(
            component="API Backend",
            tech=backend_tech,
            kind="backend",
            capacity_rps=backend_cap,
            max_connections=backend_conn_limit,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- Database (só entra se houver tech de banco) ---
    db_cap = DEFAULT_DB_CAP_RPS * db_count
    db_conn_limit = DEFAULT_CONN_LIMIT
    if db_tech:
        cap_data = _capacity_for(db_tech)
        if cap_data:
            db_cap = cap_data["rps_per_instance"] * db_count
            db_conn_limit = int(cap_data["max_connections"])
        # Ajuste para Postgres em instância pequena
        if "postgres" in db_tech.lower():
            db_cap = POSTGRES_PRACTICAL_ON_T3_MEDIUM * db_count
        capacities.append(ComponentCapacity(
            component="Database",
            tech=db_tech,
            kind="database",
            capacity_rps=db_cap,
            max_connections=db_conn_limit,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- Cache ---
    if cache_tech:
        cap_data = _capacity_for(cache_tech)
        cache_cap = cap_data["rps_per_instance"] if cap_data else DEFAULT_CACHE_CAP_RPS
        capacities.append(ComponentCapacity(
            component="Cache",
            tech=cache_tech,
            kind="cache",
            capacity_rps=cache_cap,
            max_connections=DEFAULT_CACHE_CONNS,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- Load Balancer ---
    if lb_tech:
        capacities.append(ComponentCapacity(
            component="Load Balancer",
            tech=lb_tech,
            kind="cloud",
            capacity_rps=CLOUD_LB_CAP_RPS,
            max_connections=CLOUD_CONNS,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- CDN ---
    if cdn_tech:
        capacities.append(ComponentCapacity(
            component="CDN",
            tech=cdn_tech,
            kind="cloud",
            capacity_rps=CDN_CAP_RPS,
            max_connections=CLOUD_CONNS,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- Queue/Messaging ---
    if queue_tech:
        cap_data = _capacity_for(queue_tech)
        queue_cap = cap_data["rps_per_instance"] if cap_data else DEFAULT_QUEUE_CAP_RPS
        capacities.append(ComponentCapacity(
            component="Message Queue",
            tech=queue_tech,
            kind="integration",
            capacity_rps=queue_cap,
            max_connections=DEFAULT_QUEUE_CONNS,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- Lambda ---
    if lambda_tech:
        capacities.append(ComponentCapacity(
            component="Lambda",
            tech=lambda_tech,
            kind="cloud",
            capacity_rps=LAMBDA_CAP_PER_BACKEND * backend_count,
            max_connections=LAMBDA_CONNS,
            utilization_pct=0.0,  # preenchido por _annotate_component_utilization
        ))

    # --- Capacidade do sistema na base crua; multiplicadores só com aresta real ---
    effective_caps: list[float] = [c.capacity_rps for c in capacities if c.capacity_rps > 0]
    raw_min_cap = min(effective_caps) if effective_caps else DEFAULT_BACKEND_CAP_RPS
    system_cap = raw_min_cap

    if lb_linked:
        system_cap *= ARCHITECTURE_MULTIPLIERS["load_balancer"]
    if cache_linked:
        system_cap *= ARCHITECTURE_MULTIPLIERS["cache"]
    if cdn_node_id in linked:
        system_cap *= ARCHITECTURE_MULTIPLIERS["cdn"]
    if queue_node_id in linked:
        system_cap *= ARCHITECTURE_MULTIPLIERS["queue"]
    if lambda_tech and not lb_tech:
        system_cap = min(system_cap, LAMBDA_SYSTEM_CAP_FLOOR)

    # Deduz da capacidade se o DB for o componente mais apertado (base crua)
    if db_tech and backend_tech and db_cap < backend_cap:
        cache_effective = ARCHITECTURE_MULTIPLIERS["cache"] if cache_linked else 1.0
        system_cap = min(system_cap, db_cap * cache_effective)
        bottlenecks.append(Bottleneck(
            node_id=db_node_id,
            component=db_tech,
            reason=f"DB ~{int(db_cap)} RPS vs API ~{int(backend_cap)} RPS/instância.",
            severity="critical" if db_cap < backend_cap * DB_CRITICAL_RATIO else "warning",
            saturation_pct=100 * backend_cap / max(db_cap, 1),
        ))

    # Backend mais apertado que o gargalo principal e sem LB → SPOF sob pico
    if backend_tech and not lb_tech and backend_cap < raw_min_cap * SPOF_BACKEND_RATIO:
        bottlenecks.append(Bottleneck(
            node_id=backend_node_id,
            component=backend_tech,
            reason=f"Backend ~{int(backend_cap)} RPS/instância sem LB — SPOF sob pico.",
            severity="warning",
            saturation_pct=100,
        ))

    # Conexões do DB (modelo único; sem info de pico nesta fase → pool de workers)
    if db_tech and db_conn_limit > 0:
        estimated_conns = _estimate_db_connections(0.0, backend_count)
        if estimated_conns > db_conn_limit:
            bottlenecks.append(Bottleneck(
                node_id=db_node_id,
                component=db_tech,
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
    - stress: rampa progressiva até 3× o target, vai além da capacidade
    - soak: carga sustentada em SOAK_LOAD_RATIO do target por tempo prolongado

    `LoadReport.type` reporta o padrão efetivo aplicado à curva, não o tipo
    nominal do cenário: stress → "gradual", soak → "constant" (o schema
    LoadType só aceita curvas; se o S2 estender com "stress"/"soak", a regra
    fica centralizada em EFFECTIVE_TYPE_BY_TEST_MODE).
    """
    duration = scenario.duration_seconds
    target = float(scenario.requests_per_second)
    timeline: list[LoadPoint] = []
    peak = 0.0
    err_peak = 0.0
    sat_at: int | None = None
    sum_rps = 0.0

    steps = max(1, min(duration, TIMELINE_MAX_STEPS if include_timeline else SUMMARY_MAX_STEPS))
    step_s = duration / steps

    # Invariante do loop — hoisted (não recalcula a cada timestep)
    critical_bottlenecks = [b for b in bottlenecks if b.severity == "critical"]
    knee = DEGRADATION["knee"]
    saturation = DEGRADATION["saturation"]
    critical = DEGRADATION["critical"]

    for i in range(steps):
        t = round((i + 1) * step_s)
        progress = (i + 1) / steps

        # Padrão de carga nominal (calculado e depois ajustado pelo test_mode)
        if scenario.type == "constant":
            rps = target
        elif scenario.type == "gradual":
            rps = target * progress
        elif scenario.type == "spike":
            if progress < SPIKE_RAMP_END:
                rps = target * SPIKE_PRE_RPS
            elif progress < SPIKE_PEAK_END:
                rps = target * scenario.burst_multiplier
            else:
                rps = target * SPIKE_POST_RPS
        else:  # periodic
            wave = 0.5 + 0.5 * math.sin(progress * math.pi * PERIODIC_CYCLES)
            rps = target * (PERIODIC_BASE + PERIODIC_WAVE * wave) * (scenario.burst_multiplier if wave > PERIODIC_BURST_WAVE else 1.0)

        # Ajustes por test_mode (a curva nominal é descartada nestes modos)
        if test_mode == "stress":
            # Stress: sempre aumenta, vai além da capacidade
            stress_factor = 1.0 + progress * 2.0
            rps = target * stress_factor
        elif test_mode == "soak":
            # Soak: carga constante reduzida para teste de longo prazo
            rps = target * SOAK_LOAD_RATIO

        rps = _noise(rng, realism, rps, RPS_NOISE_PCT)
        load_ratio = rps / max(capacity, 1.0)
        saturated = load_ratio >= saturation
        if saturated and sat_at is None:
            sat_at = t

        # Modelo de erro realista baseado em degradação por componente
        base_err = ERR_BASE

        # Erro sobe de forma não-linear após 70% da capacidade
        if load_ratio > knee:
            knee_factor = (load_ratio - knee) / (1.0 - knee)
            base_err += knee_factor ** 2 * ERR_KNEE_SLOPE

        if load_ratio > critical:
            overflow = load_ratio - critical
            base_err += min(ERR_OVERFLOW_CAP, overflow * ERR_OVERFLOW_SLOPE)

        # Efeito cascata de gargalos críticos
        if critical_bottlenecks and load_ratio > knee:
            cascade_mult = min(CASCADE_MULT_MAX, 1.0 + len(critical_bottlenecks) * CASCADE_STEP)
            base_err *= cascade_mult

        # Erro base por saturação de componentes
        for cap in component_caps:
            if cap.capacity_rps > 0:
                cap_ratio = rps / cap.capacity_rps
                if cap_ratio > saturation:
                    cap_err = (cap_ratio - saturation) * COMP_SAT_ERR_SLOPE
                    base_err = min(ERR_CAP, base_err + cap_err)

        err = min(ERR_CAP, _noise(rng, realism, base_err, ERR_NOISE_PCT))

        # Latência P95 realista
        p95 = P95_BASE_MS + load_ratio * P95_LOAD_SLOPE_MS
        if load_ratio > knee:
            p95 += P95_KNEE_SLOPE_MS * (load_ratio - knee)
        if saturated:
            # max(0, ...): só acréscimo por carga ACIMA do limiar — sem ele,
            # o p95 "curava" ao cruzar a saturação (ex.: 250ms em 0.84 → 205ms em 0.85).
            p95 += P95_SAT_SLOPE_MS * max(0.0, load_ratio - P95_SAT_RATIO)
        p95 = _noise(rng, realism, p95, P95_NOISE_PCT)

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

    # steps é sempre ≥ 1 (max(1, ...)) — média direta
    avg = sum_rps / steps

    # Critério de sucesso por test_mode (modo desconhecido herda o critério de load)
    if test_mode == "stress":
        # Stress: ok se suportou pelo menos 1.5× a capacidade
        ok = peak < capacity * STRESS_OK_PEAK_RATIO and err_peak < STRESS_ERR_MAX
    elif test_mode == "soak":
        # Precedência explícita: "não saturou" só vale com erro pico baixo;
        # saturou só passa se foi tardia (> 80% do tempo) E erro baixo.
        ok = (sat_at is None and err_peak < SOAK_ERR_MAX) or (
            sat_at is not None and sat_at > duration * SOAK_LATE_SAT_RATIO and err_peak < SOAK_ERR_MAX
        )
    else:
        ok = sat_at is None and err_peak < LOAD_ERR_MAX

    effective_type = EFFECTIVE_TYPE_BY_TEST_MODE.get(test_mode, scenario.type)
    return LoadReport(
        scenario_name=scenario.name,
        type=effective_type,
        peak_rps=round(peak, 1),
        avg_rps=round(avg, 1),
        estimated_capacity_rps=capacity,
        saturation_at_seconds=sat_at,
        error_rate_peak=round(err_peak, 4),
        bottlenecks=bottlenecks,
        timeline=timeline,
        ok=ok,
    )


# Padrão efetivo reportado em LoadReport.type por test_mode (item 6).
# "load" (e modos desconhecidos) mantém o tipo do cenário.
EFFECTIVE_TYPE_BY_TEST_MODE: dict[str, str] = {"stress": "gradual", "soak": "constant"}


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
        # drop sobe com pressão e tipo sensível (payment/auth/checkout)
        sens = SENSITIVE_DROP_BOOST if step.kind in SENSITIVE_STEP_KINDS else 1.0
        drop = min(0.9, step.drop_off_rate * sens * (DROP_BASE + DROP_PRESSURE_SLOPE * pressure))
        drop = min(0.9, _noise(rng, realism, drop, DROP_NOISE_PCT))
        dropped = round(entered * drop)
        completed = max(0, entered - dropped)
        latency = step.think_time_ms * (1 + LATENCY_PRESSURE_SLOPE * max(0.0, pressure - LATENCY_PRESSURE_OFFSET))
        latency = _noise(rng, realism, latency, LATENCY_NOISE_PCT)
        success = completed / entered if entered else 0.0
        if drop >= HOTSPOT_DROP_THRESHOLD:
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
    ok = conversion >= JOURNEY_OK_CONVERSION and pressure < JOURNEY_OK_PRESSURE
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
    """Simula eventos de incidente.

    Boost de probabilidade por allowlist de event_type: só tipos conhecidos
    (CACHE_EVENT_TYPES / DB_EVENT_TYPES) recebem boost, no máximo 1 por evento.

    `max_cascade_fanout` mede o FAN-OUT máximo: quantos eventos dependentes um
    evento disparou no máximo — não a profundidade da cascata. O campo do
    schema foi renomeado de `cascade_depth` para `max_cascade_fanout`
    (contrato S1a/S2 já cumpriu no schema).
    """
    triggered: list[TriggeredEvent] = []
    max_cascade_fanout = 0

    for pattern in patterns:
        # pressão aumenta chance
        prob = min(1.0, pattern.trigger_probability * (EVENT_BASE_FACTOR + EVENT_PRESSURE_FACTOR * pressure))
        if pattern.event_type in CACHE_EVENT_TYPES and not has_cache:
            prob = min(1.0, prob * CACHE_EVENT_BOOST)
        elif pattern.event_type in DB_EVENT_TYPES and pressure > DB_BOOST_PRESSURE:
            prob = min(1.0, prob * DB_EVENT_BOOST)
        roll = rng.random()
        fire = roll < prob
        cascade: list[str] = []
        if fire and pattern.cascade_enabled:
            dep_prob = DEP_PROB_PROTECTED if has_lb or has_cache else DEP_PROB_BARE
            for dep in pattern.dependent_events:
                if rng.random() < dep_prob:
                    cascade.append(dep)
            max_cascade_fanout = max(max_cascade_fanout, len(cascade))

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
    return EventReport(triggered_count=fires, events=triggered, max_cascade_fanout=max_cascade_fanout, ok=ok)


def _annotate_component_utilization(components: list[ComponentCapacity], peak_rps: float) -> None:
    """Preenche `utilization_pct` (pico/capacidade em %) e marca o gargalo.

    `is_bottleneck` fica True no argmin de capacidade efetiva (crua) — no
    máximo um componente (empates marcam todos os mínimos iguais; na
    prática as capacidades diferem).
    """
    positive_caps = [c.capacity_rps for c in components if c.capacity_rps > 0]
    min_cap = min(positive_caps) if positive_caps else None
    for comp in components:
        comp.utilization_pct = round(peak_rps / comp.capacity_rps * 100.0, 1) if comp.capacity_rps > 0 else 0.0
        comp.is_bottleneck = comp.capacity_rps == min_cap if min_cap is not None else False


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

    # Identifica gargalo principal (argmin de capacidade efetiva)
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
        if utilization > AUDIT_UTIL_CRITICAL_PCT:
            failure_scenarios.append(
                f"❌ **{bottleneck_comp.tech}** satura em ~{int(bottleneck_comp.capacity_rps)} RPS. "
                f"Com {int(peak_rps)} RPS de pico, há {int(utilization - 100)}% de overload."
            )
            recommendations.append(f"Adicione mais instâncias de {bottleneck_comp.tech} ou migre para versão maior.")
        elif utilization > AUDIT_UTIL_WARN_PCT:
            failure_scenarios.append(
                f"⚠️ **{bottleneck_comp.tech}** opera em ~{int(utilization)}% da capacidade. "
                f"Margem pequena para picos."
            )
            recommendations.append(f"Considere escalar {bottleneck_comp.tech} verticalmente ou adicionar redundância.")

    # Análise de connection pooling (mesmo modelo único do estimate)
    db_cap = next((c for c in component_caps if c.kind == "database"), None)
    if db_cap and db_cap.max_connections > 0:
        backend_count = sum(1 for n in nodes if _node_data(n).get("kind") == "backend") or 1
        est_conns = _estimate_db_connections(peak_rps, backend_count)
        if est_conns > db_cap.max_connections * DB_CONN_HEADROOM:
            failure_scenarios.append(
                f"⚠️ Conexões estimadas (~{est_conns}) aproximam-se do limite de {db_cap.max_connections} conexões do {db_cap.tech}."
            )
            recommendations.append("Configure PgBouncer/Connection Pooler para reutilizar conexões.")

    # Análise de cache
    if not has_cache and peak_rps > CACHE_RECOMMEND_RPS:
        failure_scenarios.append("⚠️ Sem cache sob carga moderada/alta — DB será sobrecarregado.")
        recommendations.append("Adicione Redis/ElastiCache para cache de leitura e sessões.")

    # Análise de load balancer
    if not has_lb and peak_rps > LB_RECOMMEND_RPS:
        failure_scenarios.append("⚠️ Sem LB sob carga alta — risco de SPOF em instância única.")
        recommendations.append("Adicione Load Balancer para distribuição e health checks.")

    # Análise de fila
    has_web_backend = _has(techs, "fastapi") or _has(techs, "express") or _has(techs, "nest")
    if has_web_backend and not has_queue and peak_rps > QUEUE_RECOMMEND_RPS:
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
    """Valida o resultado contra as regras.

    Contrato S2: `ValidationRule.metric` é whitelist fechada no schema —
    métrica desconhecida já cai em 422 na rota. Regra fail-closed: métrica
    ausente no resultado com `required=True` → `passed=False`.
    """
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


CSV_SCALAR_COLUMNS = [
    "seed", "test_mode", "realism_score", "capacity_rps", "peak_rps",
    "error_rate_peak", "conversion_rate", "bottleneck_tech", "headroom_pct",
]
CSV_TIMELINE_COLUMNS = ["timestamp", "rps", "error_rate", "p95_ms", "saturated"]


def _csv_scalar_row(result: SimulationResult) -> dict[str, object]:
    audit = result.engineering_audit
    return {
        "seed": result.seed,
        "test_mode": result.test_mode,
        "realism_score": result.realism_score,
        "capacity_rps": result.estimated_capacity_rps,
        "peak_rps": result.load.peak_rps if result.load else "",
        "error_rate_peak": result.load.error_rate_peak if result.load else "",
        "conversion_rate": result.journey.conversion_rate if result.journey else "",
        "bottleneck_tech": (audit.bottleneck_tech or "none") if audit else "",
        "headroom_pct": audit.headroom_pct if audit else "",
    }


def _export(result: SimulationResult, fmt: str) -> tuple[str, str]:
    """Exporta o resultado no formato pedido.

    CSV: linha de escalares (uma coluna por campo) + uma linha por ponto da
    timeline quando `include_timeline=True`; sem timeline, o CSV traz só a
    linha de escalares. Journey/eventos/findings ficam no JSON/Prometheus.
    """
    if fmt == "csv":
        has_timeline = bool(result.load and result.load.timeline)
        columns = CSV_SCALAR_COLUMNS + (CSV_TIMELINE_COLUMNS if has_timeline else [])
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        scalars = _csv_scalar_row(result)
        scalar_cells = [scalars[col] for col in CSV_SCALAR_COLUMNS]
        writer.writerow(scalar_cells + ([""] * len(CSV_TIMELINE_COLUMNS) if has_timeline else []))
        for point in (result.load.timeline if has_timeline else []):
            writer.writerow(
                [""] * len(CSV_SCALAR_COLUMNS)
                + [point.t_seconds, point.rps, point.error_rate, point.p95_ms, point.saturated]
            )
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


def _noise(rng: random.Random, realism: float, base: float, pct: float = RPS_NOISE_PCT) -> float:
    """Jitter limitado: a amplitude efetiva tem teto em NOISE_AMP_MAX —
    sem o teto, realism=1.0 com pct=0.25 gerava ±42.5% de jitter dominando
    a métrica (ex.: p95)."""
    if realism <= 0:
        return base
    amp = min(NOISE_AMP_MAX, pct * (NOISE_BASE + NOISE_REALISM_SLOPE * realism))
    return base * (1.0 + rng.uniform(-amp, amp))


def run_simulation(req: SimulationRequest) -> SimulationResult:
    """Roda a simulação completa (carga, jornada, eventos, audit, export).

    Contrato com o front (S2/S3b):
    - `presets_used` NÃO é preenchido aqui — a rota run-preset enriquece o
      resultado; o engine não conhece presets;
    - `reproducible` fica com o default do schema (True): todo o RNG deriva
      de `req.seed` (int, default 42, nunca None), então run com inputs
      idênticos é sempre determinístico;
    - `req.context` (quando não vazio) vira linha nas findings e sufixo no
      texto do summary;
    - capacidades de componente saem com `utilization_pct` preenchido e
      `is_bottleneck` no argmin de capacidade; gargalos carregam `node_id`.
    """
    rng = random.Random(req.seed)
    capacity, component_caps, bottlenecks = estimate_component_capacities(req.nodes, req.edges)
    techs = _techs(req.nodes)
    has_cache = _has(techs, "Redis", "ElastiCache")
    has_lb = _has(techs, "ALB", "Load Balancer")

    findings: list[str] = []
    context = req.context.strip()
    if context:
        findings.insert(0, f"Contexto: {context}")

    load = req.load or LoadScenario()
    load_report = simulate_load(
        load, capacity, bottlenecks, component_caps,
        rng, req.realism_level, req.include_timeline,
        test_mode=req.test_mode,
    )
    peak = load_report.peak_rps
    pressure = peak / max(capacity, 1.0)

    # Preenche utilization/is_bottleneck antes do audit e do export
    _annotate_component_utilization(component_caps, peak)

    journey = req.journey or UserJourney(steps=DEFAULT_JOURNEY_STEPS)
    journey_report = simulate_journey(journey, capacity, peak, rng, req.realism_level)

    if req.events:
        event_report = simulate_events(req.events, pressure, rng, has_cache, has_lb)
    else:
        event_report = EventReport(triggered_count=0, events=[], max_cascade_fanout=0, ok=True)

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
    context_part = f" · contexto: {context}" if context else ""
    summary = (
        f"[{mode_label}] Capacidade ~{capacity:.0f} RPS · pico simulado {load_report.peak_rps:.1f} RPS "
        f"· margem {audit.headroom_pct:.0f}% · realismo {realism:.0%} "
        f"· custo ~US${cost:.2f}/mês · seed {req.seed}{context_part}"
    )

    result = SimulationResult(
        seed=req.seed,
        realism_score=realism,
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
    output_format: OutputFormat = "json",
    test_mode: TestMode = "load",
) -> SimulationRequest:
    """Monta um SimulationRequest a partir de um preset.

    Os sub-models do preset são copiados em profundidade (`model_copy(deep=True)`)
    para que mutações na request nunca corrompam a lista global PRESETS.
    `test_mode`/`output_format` usam os Literais do schema: valor fora da
    whitelist cai em ValidationError na construção da SimulationRequest.
    """
    preset = get_preset(preset_id)
    if not preset:
        raise ValueError(f"Preset desconhecido: {preset_id}")
    load = preset.load.model_copy(deep=True) if preset.load is not None else None
    journey = preset.journey.model_copy(deep=True) if preset.journey is not None else None
    events = [event.model_copy(deep=True) for event in preset.events]
    return SimulationRequest(
        name=preset.label,
        context=context,
        nodes=nodes,
        edges=edges,
        seed=seed,
        realism_level=realism_level,
        test_mode=test_mode,
        load=load,
        journey=journey,
        events=events,
        output_format=output_format,
    )
