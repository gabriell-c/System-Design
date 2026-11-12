import assert from "node:assert/strict";
import test from "node:test";

// ============================================================
// S3b — teste de contrato do espelho manual (ruling: sync manual +
// este arquivo + tsc no gate, SEM openapi-typescript).
//
// Os types importados aqui são apagados em runtime pelo
// `--experimental-strip-types` → o valor de runtime é a afirmação
// sobre os FIXTURES (shape das respostas do backend, lidas de
// `backend/app/schemas/simulation.py`); a força de tipo (whitelists
// fechadas, renames, campos novos) vem do tsc do gate.
// ============================================================

import type {
  EventReport,
  JourneyStepKind,
  PresetRunPayload,
  SimulationResult,
  SimulationScenarioPayload,
  ValidationMetric,
  ValidationRule,
} from "./simulation";
import type {
  BlastRadiusResult,
  CircuitBreakersResult,
  CostBreakdown,
  FailureInjectionResult,
  LiveDocResult,
} from "./types";

test("EventReport: max_cascade_fanout (renomeado de cascade_depth)", () => {
  const report: EventReport = {
    triggered_count: 1,
    events: [{ event_type: "failover", triggered: true, roll: 0.4, cascade: ["a", "b"], impact: "x", severity: "warning" }],
    max_cascade_fanout: 3,
    ok: true,
  };
  assert.equal(report.max_cascade_fanout, 3);
  // O campo antigo deixou de existir no tipo (excess property check):
  // @ts-expect-error — `cascade_depth` foi removido pelo rename
  const old: EventReport = { ...report, cascade_depth: 2 };
  void old;
});

test("ValidationRule.metric: whitelist fechada (6 métricas do backend)", () => {
  const rule: ValidationRule = { metric: "capacity_rps", min_value: 100 };
  assert.equal(rule.metric, "capacity_rps");
  const metrics: ValidationMetric[] = [
    "capacity_rps",
    "realism_score",
    "peak_rps",
    "error_rate_peak",
    "avg_rps",
    "conversion_rate",
  ];
  assert.equal(metrics.length, 6, "whitelist espelhada do Literal ValidationMetric");
  // Fora da whitelist → 422 no backend; o type trava o valor:
  // @ts-expect-error — `banana` não é uma métrica válida
  const bad: ValidationRule = { metric: "banana" };
  void bad;
});

test("JourneyStepKind: Literal de 8 kinds (default 'browse' no backend)", () => {
  const kinds: JourneyStepKind[] = [
    "landing",
    "browse",
    "auth",
    "read",
    "write",
    "checkout",
    "payment",
    "confirm",
  ];
  assert.equal(kinds.length, 8);
});

test("SimulationResult: seed/reproducible/presets_used + engineering_audit", () => {
  const result: SimulationResult = {
    seed: 42,
    realism_score: 0.82,
    reproducible: true,
    estimated_capacity_rps: 1200,
    test_mode: "load",
    summary: "ok",
    load: {
      scenario_name: "p",
      type: "spike",
      peak_rps: 500,
      avg_rps: 300,
      estimated_capacity_rps: 1200,
      saturation_at_seconds: null,
      error_rate_peak: 0.01,
      bottlenecks: [{ node_id: "n1", component: "db", reason: "conexões", severity: "critical", saturation_pct: 98 }],
      timeline: [{ t_seconds: 0, rps: 0, error_rate: 0, p95_ms: 0, saturated: false }],
      ok: true,
    },
    journey: null,
    events: { triggered_count: 0, events: [], max_cascade_fanout: 0, ok: true },
    validations: [],
    validations_passed: true,
    findings: [],
    engineering_audit: {
      bottleneck_component: "db",
      bottleneck_tech: "postgres",
      bottleneck_rps: 900,
      system_capacity_rps: 1200,
      headroom_pct: 25,
      component_capacities: [
        { component: "api", tech: "node", kind: "service", capacity_rps: 1200, max_connections: 5000, utilization_pct: 75, is_bottleneck: false },
        { component: "db", tech: "postgres", kind: "database", capacity_rps: 900, max_connections: 1000, utilization_pct: 98, is_bottleneck: true },
      ],
      failure_scenarios: [],
      recommendations: [],
    },
    export_body: null,
    export_content_type: null,
    presets_used: ["preset-spike"],
  };
  assert.equal(result.reproducible, true);
  assert.equal(result.presets_used[0], "preset-spike");
  assert.equal(result.events?.max_cascade_fanout, 0);
  assert.equal(result.engineering_audit?.component_capacities[1]?.is_bottleneck, true);
});

test("PresetRunPayload: campos do run via preset (S3a manda estes)", () => {
  const payload: PresetRunPayload = {
    preset_id: "preset-spike",
    nodes: [],
    edges: [],
    seed: 7,
    realism_level: 0,
    test_mode: "stress",
    journey: { name: "j", steps: [{ id: "s1", name: "n", kind: "browse" }], concurrent_users: 10 },
    events: [],
    validation_rules: [{ metric: "peak_rps", min_value: 10 }],
    include_timeline: true,
  };
  assert.equal(payload.preset_id, "preset-spike");
});

test("SimulationScenarioPayload: campos tipados + chaves legadas free-form (extra=allow)", () => {
  const payload: SimulationScenarioPayload = {
    preset_id: "p1",
    seed: 7,
    realism_level: 0,
    test_mode: "soak",
    validation_rules: [{ metric: "error_rate_peak", max_value: 0.05 }],
    legacy_free_form: { anything: [1, 2] },
  };
  assert.equal(payload.preset_id, "p1");
  assert.deepEqual(payload.legacy_free_form, { anything: [1, 2] });
});

test("FailureInjectionResult: mínimo { ok } + shape completo do backend", () => {
  const minimal: FailureInjectionResult = { ok: true };
  assert.equal(minimal.ok, true);
  const full: FailureInjectionResult = {
    ok: false,
    error: "nó não encontrado",
    failed_node_id: "n1",
    failed_label: "Gateway",
    mode: "down",
    mode_detail: "down",
    unreachable_node_ids: ["n2"],
    degraded_node_ids: ["n3"],
    fallback_activations: [{ edge_behavior: "failover", from: "a", to: "b", detail: "x" }],
    critical_path_broken: 1,
    critical_path_total: 2,
    journeys_broken_pct: 50,
    affected_node_ids: ["n2", "n3"],
    summary: "resumo",
  };
  assert.equal(full.journeys_broken_pct, 50);
});

test("BlastRadiusResult: espelho de BlastRadiusOut (labels/hops/highlight no payload)", () => {
  const res: BlastRadiusResult = {
    ok: true,
    failed_node_id: "n1",
    mode: "down",
    unreachable_node_ids: ["n2", "n3"],
    degraded_node_ids: ["n4"],
    affected_node_ids: ["n2", "n3", "n4"],
    summary: "x",
    origin_node_id: "n1",
    origin_label: "Gateway",
    max_hops: 2,
    hops: { "1": ["n2"], "2": ["n3", "n4"] },
    highlight_edge_ids: ["e1"],
    highlight_edges: [{ id: "e1" }],
    node_labels: { n2: "Svc A", n3: "Svc B", n4: "Svc C" },
  };
  assert.equal(res.origin_label, "Gateway");
  assert.equal(res.node_labels?.n2, "Svc A");
});

test("CircuitBreakersResult / CostBreakdown / LiveDocResult: espelhos estáveis", () => {
  const cb: CircuitBreakersResult = {
    breakers: [{ type: "node", node_id: "n1" }],
    breaker_count: 1,
    gaps: ["sem breaker na edge e1"],
    recommendation: "adicione breaker",
  };
  assert.equal(cb.breaker_count, cb.breakers.length);
  const cost: CostBreakdown = {
    line_items: [{ node_id: "n1", label: "L", catalog_id: "c", region: "us", cost_key: "k", cost_usd_month: 10, priced: true }],
    total_usd_month: 10,
    by_region: { us: 10 },
    node_count: 1,
    priced_count: 1,
    price_table_version: "2025-static-v1",
    summary: "s",
  };
  assert.equal(cost.total_usd_month, 10);
  const doc: LiveDocResult = { markdown: "# doc", anchors: { s1: "a" }, updated_at: "2026-11-12T00:00:00Z" };
  assert.equal(doc.markdown.length, 5);
});
