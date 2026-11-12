"""Testes TDD do engine de carga (S1a): cada bug de resultado tem teste falhando primeiro.

Itens cobertos (rulings documentados em app/services/simulation.py):
- item 1: precedência do critério de sucesso do soak
- item 2: p95 monótono na fronteira de saturação
- item 3: sem componente fantasma (DB/backend ausente não entra no grafo)
- item 4: preset global imutável (deep copy nos sub-models)
- item 5: multiplicadores de arquitetura só com aresta real
- item 6: LoadReport.type reporta o padrão efetivo (não o tipo nominal)
- item 7: max_cascade_fanout (semântica fan-out; schema já renomeado pelo S2)
- item 8: modelo único de conexões de DB
- item 10: allowlist de boosts por event_type (sem dupla-fogueia por substring)
- item 13/14: reproducible/presets_used por default do schema + enriquecimento da rota
- item 15: dedupe de techs + busca derivada da tabela de capacidade
- item 16: lookup de capacidade case-insensitive
- item 17: teto de amplitude do ruído
- item 18/24: summary formatado + CSV com colunas reais
- item 19: build_request_from_preset tipado (Literal dos schemas)
- item 22: utilization_pct + is_bottleneck populados
- item 23: Bottleneck.node_id populado
- item 25: req.context consumido (findings + summary)
"""

from __future__ import annotations

import itertools
import random
import re

import pytest
from pydantic import ValidationError

from app.schemas.simulation import (
    Bottleneck,
    EventPattern,
    LoadScenario,
    SimulationRequest,
)
from app.services.simulation import (
    _estimate_db_connections,
    _noise,
    _techs,
    build_request_from_preset,
    estimate_component_capacities,
    get_preset,
    list_presets,
    run_simulation,
    simulate_events,
    simulate_load,
)

NODES_FASTAPI_PG = [
    {
        "id": "b1",
        "data": {"kind": "backend", "label": "API", "catalogId": "be-fastapi", "config": {"framework": "FastAPI"}},
    },
    {
        "id": "d1",
        "data": {"kind": "database", "label": "DB", "catalogId": "db-postgres", "config": {"engine": "PostgreSQL"}},
    },
]
EDGE_B1_D1 = [{"source": "b1", "target": "d1"}]

REDIS_NODE = {
    "id": "c1",
    "data": {"kind": "cloud", "label": "Redis", "catalogId": "cloud-redis", "config": {"service": "Redis"}},
}


def _seed_with_roll(lo: float, hi: float, inclusive_hi: bool = False) -> int:
    """Seed cujo primeiro random() cai em [lo, hi) (ou [lo, hi] se inclusive_hi)."""
    for seed in range(100_000):
        roll = random.Random(seed).random()
        if roll >= lo and (roll < hi or (inclusive_hi and roll == hi)):
            return seed
    raise AssertionError(f"nenhum seed com roll em [{lo}, {hi})")


# ── Item 1: precedência do critério do soak ──────────────────────────────────


def test_soak_sem_saturacao_com_erro_alto_nao_passa():
    """Soak que nunca saturou SÓ dá ok se o erro pico também for baixo."""
    bottlenecks = [
        Bottleneck(component="X", reason="r1", severity="critical", saturation_pct=100.0),
        Bottleneck(component="Y", reason="r2", severity="critical", saturation_pct=100.0),
    ]
    rep = simulate_load(
        LoadScenario(name="soak", type="constant", requests_per_second=105, duration_seconds=60),
        capacity=100.0,
        bottlenecks=bottlenecks,
        component_caps=[],
        rng=random.Random(1),
        realism=0.0,
        include_timeline=False,
        test_mode="soak",
    )
    assert rep.saturation_at_seconds is None
    assert rep.error_rate_peak >= 0.1
    assert rep.ok is False


def test_soak_saudavel_passa():
    rep = simulate_load(
        LoadScenario(name="ok", type="constant", requests_per_second=40, duration_seconds=120),
        capacity=100.0,
        bottlenecks=[],
        component_caps=[],
        rng=random.Random(1),
        realism=0.0,
        include_timeline=False,
        test_mode="soak",
    )
    assert rep.saturation_at_seconds is None
    assert rep.ok is True


def test_soak_saturacao_precoce_falha():
    """Soak roda em carga constante (80% do target): saturando, satura do
    primeiro passo em diante → não passa mesmo com erro baixo."""
    rep = simulate_load(
        LoadScenario(name="alto", type="constant", requests_per_second=100, duration_seconds=60),
        capacity=90.0,
        bottlenecks=[],
        component_caps=[],
        rng=random.Random(1),
        realism=0.0,
        include_timeline=False,
        test_mode="soak",
    )
    # 80 RPS / 90 de capacidade = 0.889 ≥ limiar de saturação (0.85)
    assert rep.saturation_at_seconds is not None
    assert rep.saturation_at_seconds <= 60 * 0.8
    assert rep.ok is False


# ── Item 2: p95 monótono (não "cura" no limiar de saturação) ────────────────


def test_p95_monotonico_na_fronteira_de_saturacao():
    def p95(target: int) -> float:
        rep = simulate_load(
            LoadScenario(name="t", type="constant", requests_per_second=target, duration_seconds=30),
            capacity=100.0,
            bottlenecks=[],
            component_caps=[],
            rng=random.Random(7),
            realism=0.0,
            include_timeline=True,
            test_mode="load",
        )
        return rep.timeline[0].p95_ms

    assert p95(84) <= p95(85) <= p95(86)


def test_p95_monotonico_em_timeline_progressiva():
    rep = simulate_load(
        LoadScenario(name="g", type="gradual", requests_per_second=100, duration_seconds=25),
        capacity=100.0,
        bottlenecks=[],
        component_caps=[],
        rng=random.Random(7),
        realism=0.0,
        include_timeline=True,
        test_mode="load",
    )
    p95s = [p.p95_ms for p in rep.timeline]
    assert all(a <= b for a, b in itertools.pairwise(p95s))


# ── Item 3: sem componente fantasma ─────────────────────────────────────────


def test_grafo_cache_only_nao_reporta_database():
    cap, comps, bots = estimate_component_capacities([REDIS_NODE], [])
    assert cap > 0
    assert not any(c.kind == "database" for c in comps)
    assert not any(c.kind == "backend" for c in comps)
    assert bots == []


def test_grafo_sem_banco_sem_bottleneck_de_db():
    nodes = [NODES_FASTAPI_PG[0], REDIS_NODE]
    _, _, bots = estimate_component_capacities(nodes, [{"source": "b1", "target": "c1"}])
    assert not any("DB ~" in b.reason for b in bots)
    assert not any(b.component.lower() in {"database"} for b in bots)


# ── Item 4: preset global não é corrompido pela request ─────────────────────


def test_request_do_preset_nao_corrompe_preset_global():
    req = build_request_from_preset("black-friday-spike", NODES_FASTAPI_PG, EDGE_B1_D1)
    req.journey.name = "MUTADO"
    req.journey.steps[0].name = "MUTADO"
    req.load.name = "MUTADO"
    req.events[0].trigger_probability = 0.99

    preset = get_preset("black-friday-spike")
    assert preset.journey.name == "Compra promocional"
    assert preset.journey.steps[0].name == "Landing"
    assert preset.load.name == "Black Friday"
    assert preset.events[0].trigger_probability == 0.25
    # list_presets() devolve a mesma fonte: também deve estar intacta
    intacto = next(p for p in list_presets() if p.id == "black-friday-spike")
    assert intacto.load.name == "Black Friday"


# ── Item 5: multiplicadores de arquitetura exigem aresta real ───────────────


def test_multiplicador_de_cache_somente_com_aresta():
    nodes = [NODES_FASTAPI_PG[0], REDIS_NODE]
    cap_linkado, _, _ = estimate_component_capacities(nodes, [{"source": "b1", "target": "c1"}])
    cap_isolado, _, _ = estimate_component_capacities(nodes, [])
    assert cap_linkado > cap_isolado


def test_lb_isolado_nao_infla_capacidade():
    nodes = [
        NODES_FASTAPI_PG[0],
        {"id": "d1", "data": {"kind": "database", "config": {"engine": "DynamoDB"}}},
        {"id": "lb1", "data": {"kind": "cloud", "config": {"service": "ALB"}}},
    ]
    cap_linkado, _, _ = estimate_component_capacities(nodes, [{"source": "lb1", "target": "b1"}])
    cap_isolado, _, _ = estimate_component_capacities(nodes, [])
    assert cap_linkado > cap_isolado


def test_self_loop_nao_conecta():
    nodes = [NODES_FASTAPI_PG[0], REDIS_NODE]
    cap_self, _, _ = estimate_component_capacities(nodes, [{"source": "c1", "target": "c1"}])
    cap_sem, _, _ = estimate_component_capacities(nodes, [])
    assert cap_self == cap_sem


# ── Item 6: LoadReport.type = padrão efetivo ─────────────────────────────────


def test_soak_reporta_padrao_efetivo_constant():
    res = run_simulation(
        SimulationRequest(
            nodes=NODES_FASTAPI_PG,
            edges=EDGE_B1_D1,
            seed=3,
            test_mode="soak",
            load=LoadScenario(name="s", type="spike", requests_per_second=40, duration_seconds=60),
        )
    )
    assert res.load.type == "constant"


def test_stress_reporta_padrao_efetivo_gradual():
    res = run_simulation(
        SimulationRequest(
            nodes=NODES_FASTAPI_PG,
            edges=EDGE_B1_D1,
            seed=3,
            test_mode="stress",
            load=LoadScenario(name="s", type="spike", requests_per_second=40, duration_seconds=60),
        )
    )
    assert res.load.type == "gradual"


def test_load_mode_mantem_tipo_do_cenario():
    res = run_simulation(
        SimulationRequest(
            nodes=NODES_FASTAPI_PG,
            edges=EDGE_B1_D1,
            seed=3,
            test_mode="load",
            load=LoadScenario(name="s", type="periodic", requests_per_second=40, duration_seconds=60),
        )
    )
    assert res.load.type == "periodic"


# ── Item 7: max_cascade_fanout (fan-out máximo, não profundidade) ───────────


class _RngScriptado:
    def __init__(self, rolls: list[float]) -> None:
        self._rolls = iter(rolls)

    def random(self) -> float:
        return next(self._rolls)


def test_max_cascade_fanout_mece_fanout_maximo():
    rep = simulate_events(
        [
            EventPattern(event_type="root", trigger_probability=1.0, dependent_events=["a", "b", "c"], severity="critical"),
            EventPattern(event_type="lonely", trigger_probability=0.0),
        ],
        pressure=0.5,
        rng=_RngScriptado([0.5, 0.5, 0.5, 0.5, 0.99]),
        has_cache=True,
        has_lb=True,
    )
    assert rep.max_cascade_fanout == 3


# ── Item 8: modelo único de conexões de DB ───────────────────────────────────


def test_estimate_db_connections_pool_e_pico():
    # regime de pool (pico desconhecido) → backend_count × CONNS_PER_WORKER
    assert _estimate_db_connections(0.0, 3) == 30
    # pico maior que o pool → pico domina
    assert _estimate_db_connections(150.7, 3) == 151
    # pool maior que pico → pool domina
    assert _estimate_db_connections(5.0, 3) == 30


# ── Item 10: allowlist de boosts por event_type ─────────────────────────────


def test_event_fora_da_allowlist_nao_recebe_boost_duplo():
    """'cached_db_flush' casava com 'cache' E 'db' no modelo antigo (boost duplo).

    Prob base 0.5 × (0.8 + 0.5×1.5) = 0.775. Sem boost, dispara só se
    roll < 0.775 → com roll ≥ 0.775 NÃO dispara (com o modelo antigo
    dispararia, pois o boost duplo levava a prob a 1.0).
    """
    seed = _seed_with_roll(0.775, 1.0)
    rep = simulate_events(
        [EventPattern(event_type="cached_db_flush", trigger_probability=0.5, dependent_events=[], severity="critical")],
        pressure=1.5,
        rng=random.Random(seed),
        has_cache=False,
        has_lb=False,
    )
    assert rep.events[0].triggered is False


def test_event_de_cache_sem_cache_dispara_com_boost():
    """Evento known-allowlist de cache sem cache no grafo recebe boost 1.4×.

    Prob base 0.5 × 0.8 = 0.40; com boost 0.56. Roll em [0.40, 0.56)
    dispara SÓ se o boost for aplicado.
    """
    seed = _seed_with_roll(0.40, 0.56)
    rep = simulate_events(
        [EventPattern(event_type="cache_miss_storm", trigger_probability=0.5, dependent_events=[], severity="warning")],
        pressure=0.0,
        rng=random.Random(seed),
        has_cache=False,
        has_lb=False,
    )
    assert rep.events[0].triggered is True


# ── Itens 13/14: reproducible e presets_used seguem defaults/rota ───────────


def test_reproducible_segue_default_do_schema():
    """Toda a aleatoriedade deriva de req.seed (int, default 42, nunca None)
    → run é sempre determinístico; o service não hardcode o campo."""
    res = run_simulation(SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=5))
    assert res.reproducible is True


def test_service_devolve_presets_used_vazio():
    """O engine não conhece presets; quem enriquece é a rota run-preset."""
    res = run_simulation(SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=5))
    assert res.presets_used == []


# ── Itens 15/16: dedupe de techs + busca derivada da tabela + case-insensitive ─


def test_mariadb_casa_com_tabela_de_capacidade():
    nodes = [
        NODES_FASTAPI_PG[0],
        {"id": "d1", "data": {"kind": "database", "label": "DB", "config": {"engine": "MariaDB"}}},
    ]
    _, comps, _ = estimate_component_capacities(nodes, EDGE_B1_D1)
    db = next(c for c in comps if c.kind == "database")
    assert db.tech == "MariaDB"
    assert db.capacity_rps == 150.0  # tabela COMPONENT_CAPACITY_RPS, não fallback


def test_tech_lookup_case_insensitive():
    nodes = [
        NODES_FASTAPI_PG[0],
        {"id": "d1", "data": {"kind": "database", "config": {"engine": "postgresql"}}},
    ]
    _, comps, _ = estimate_component_capacities(nodes, EDGE_B1_D1)
    db = next(c for c in comps if c.kind == "database")
    assert db.capacity_rps == 50.0  # override PostgreSQL em instância pequena


def test_techs_deduplicados():
    node = {"id": "c1", "data": {"kind": "cloud", "tech": "Redis", "config": {"service": "Redis"}}}
    assert _techs([node]) == ["Redis"]


# ── Item 17: teto de amplitude do ruído ─────────────────────────────────────


def test_amostragem_do_ruido_tetada():
    """realism=1.0 + pct=0.25 NÃO pode dar ±42.5%: amplitude efetiva tem teto."""
    for seed in range(64):
        out = _noise(random.Random(seed), 1.0, 100.0, 0.25)
        assert 85.0 <= out <= 115.0, f"seed={seed} ultrapassou o teto de amplitude (15%)"


# ── Item 18: summary sem floats crus ─────────────────────────────────────────


def test_summary_sem_decimais_crus():
    res = run_simulation(SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=3))
    s = res.summary
    assert not re.search(r"\d\.\d{3,}", s), f"float cru no summary: {s}"
    assert re.search(r"capacidade ~\d+(?!\.\d) rps", s, re.IGNORECASE), f"capacidade sem formato :.0f: {s}"
    assert re.search(r"US\$\d+\.\d{2}/m", s), f"custo sem formato :.2f: {s}"


# ── Item 19: build_request_from_preset tipado (Literal dos schemas) ─────────


def test_build_request_rejeita_test_mode_invalido():
    with pytest.raises(ValidationError):
        build_request_from_preset("steady-saas", NODES_FASTAPI_PG, EDGE_B1_D1, test_mode="banana")


def test_build_request_rejeita_output_format_invalido():
    with pytest.raises(ValidationError):
        build_request_from_preset("steady-saas", NODES_FASTAPI_PG, EDGE_B1_D1, output_format="banana")


# ── Item 22: utilization_pct + is_bottleneck populados ──────────────────────


def test_componentes_com_utilizacao_e_bottleneck():
    res = run_simulation(SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=42))
    comps = res.engineering_audit.component_capacities
    assert len(comps) >= 2
    assert any(c.utilization_pct > 0 for c in comps)
    # argmin de capacidade efetiva: exatamente um gargalo
    assert sum(1 for c in comps if c.is_bottleneck) == 1
    gargalo = next(c for c in comps if c.is_bottleneck)
    assert gargalo.capacity_rps == min(c.capacity_rps for c in comps if c.capacity_rps > 0)


# ── Item 23: Bottleneck.node_id populado ────────────────────────────────────


def test_bottlenecks_carregam_node_id():
    _, _, bots = estimate_component_capacities(NODES_FASTAPI_PG, EDGE_B1_D1)
    db_bots = [b for b in bots if b.component.lower() == "postgresql"]
    assert db_bots, "DB deveria ser bottleneck (PostgreSQL 50 RPS vs FastAPI 2000)"
    assert all(b.node_id == "d1" for b in db_bots)


# ── Item 24: CSV com colunas reais ───────────────────────────────────────────


def test_csv_com_colunas_reais_e_timeline():
    res = run_simulation(
        SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=3, output_format="csv", include_timeline=True)
    )
    assert res.export_body is not None
    lines = res.export_body.strip().splitlines()
    header = lines[0].split(",")
    for col in ("timestamp", "rps", "error_rate", "p95_ms", "saturated", "capacity_rps"):
        assert col in header, f"coluna {col!r} ausente no CSV"
    assert len(lines) > 2  # cabeçalho + linha de escalares + timeline


def test_csv_sem_timeline_traz_apenas_escalares():
    res = run_simulation(
        SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=3, output_format="csv", include_timeline=False)
    )
    assert res.export_body is not None
    lines = res.export_body.strip().splitlines()
    assert len(lines) == 2  # cabeçalho + linha de escalares
    assert "timestamp" not in lines[0].split(",")


# ── Item 25: req.context consumido ───────────────────────────────────────────


def test_context_aparece_no_resultado():
    res = run_simulation(
        SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=3, context="migração para AWS em novembro")
    )
    assert any("migração para AWS em novembro" in f for f in res.findings)
    assert "migração para AWS em novembro" in res.summary


def test_sem_contexto_nao_ha_linha_de_contexto():
    res = run_simulation(SimulationRequest(nodes=NODES_FASTAPI_PG, edges=EDGE_B1_D1, seed=3))
    assert not any(f.startswith("Contexto") for f in res.findings)
    assert "contexto:" not in res.summary
