import assert from "node:assert/strict";
import test from "node:test";
import { toArchitectureMarkdown } from "./export.ts";
import { emptyNfr } from "./nfr.ts";

test("architecture package markdown includes vistas scorecard and how-to-test", () => {
  const nfr = {
    ...emptyNfr(),
    arch_style: "serverless" as const,
    business_processes: ["Login"],
    data_entities: ["User"],
    availability_pct: 99.9,
    critical_path_edge_ids: ["e1"],
    failure_modes: [{ component_id: "a", mode: "down", impact: "outage", mitigation: "failover" }],
  };
  const nodes = [
    {
      id: "a",
      type: "arch",
      position: { x: 0, y: 0 },
      data: { kind: "backend" as const, label: "API", catalogId: "a", tech: "x", config: {} },
    },
  ];
  const edges = [
    { id: "e1", source: "a", target: "a", data: { flowKind: "sync" as const, flowNumber: 1, isCriticalPath: true } },
  ];
  const md = toArchitectureMarkdown("Demo", nodes, edges, {
    context: "Demo context long enough for export.",
    nfr,
    analysis: {
      score: 8,
      summary: "Arquitetura: 8/10 — ok",
      strengths: [],
      risks: [],
      suggestions: [],
      findings: [],
      node_scores: {},
      growth: {
        small: { ok: true, issues: [], changes: [] },
        medium: { ok: true, issues: [], changes: [] },
        large: { ok: true, issues: [], changes: [] },
      },
      ia_ok: false,
      ia_unavailable: true,
      agents_used: ["heuristic"],
      review_scorecard: {
        narrative: 8,
        views_completeness: 8,
        placement: 8,
        flow_continuity: 8,
        operability: 8,
        decision_quality: 8,
        overall: 8,
        review_ready: true,
        gaps: [],
      },
    },
  });
  assert.match(md, /## Vistas AN \/ AD \/ AA \/ AI/);
  assert.match(md, /### Review scorecard/);
  assert.match(md, /## Como testar/);
  assert.match(md, /Architecture Package/);
  assert.match(md, /Login/);
  assert.match(md, /Caminho crítico/);
});

test("emptyNfr includes review-ready fields", () => {
  const n = emptyNfr();
  assert.ok(Array.isArray(n.critical_path_edge_ids));
  assert.ok(Array.isArray(n.failure_modes));
  assert.equal(n.slo_availability_pct, null);
});
