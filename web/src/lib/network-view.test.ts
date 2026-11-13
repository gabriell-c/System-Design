import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// src/lib → web/test/ts-ext-hooks.mjs (2 níveis acima).
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

/**
 * R8 — lógica pura do painel de Rede (sem JSX, importável sob
 * strip-types; o JSX é validado por tsc no gate). Mesmo padrão do
 * cost-view.test.ts: alias `@/` resolvido pelo ts-ext-hooks.
 */

const NETWORK_VIEW_SPEC = "@/lib/network-view";

const FLOWS_FIXTURE: import("@/lib/types").DeploymentFlowsResult = {
  ok: true,
  dev_flow: {
    node_count: 3,
    edge_count: 4,
    edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }],
  },
  user_flow: {
    node_count: 2,
    edge_count: 2,
    edges: [{ source: "u", target: "a" }],
  },
  cross_flow: { edge_count: 1, edges: [{ source: "x", target: "y" }] },
  gaps: [],
};

test("scoreLabel: ≥90 Boa / 70-89 Atenção / <70 Crítica (bordas travadas)", async () => {
  const { scoreLabel } = await import(NETWORK_VIEW_SPEC);
  assert.equal(scoreLabel(100), "Boa");
  assert.equal(scoreLabel(90), "Boa", "90 é Boa (inclusivo)");
  assert.equal(scoreLabel(89), "Atenção", "89 ainda é Atenção");
  assert.equal(scoreLabel(70), "Atenção", "70 é Atenção (inclusivo)");
  assert.equal(scoreLabel(69), "Crítica");
  assert.equal(scoreLabel(0), "Crítica");
});

test("findingsCounts: contagem por severidade (vazio → zeros)", async () => {
  const { findingsCounts } = await import(NETWORK_VIEW_SPEC);
  assert.deepEqual(findingsCounts([]), { critical: 0, warning: 0, info: 0 });
  assert.deepEqual(
    findingsCounts([
      { severity: "critical", title: "t", detail: "d" },
      { severity: "critical", title: "t", detail: "d" },
      { severity: "warning", title: "t", detail: "d", node_id: "n1" },
      { severity: "info", title: "t", detail: "d", edge_id: "e1" },
      { severity: "info", title: "t", detail: "d" },
    ]),
    { critical: 2, warning: 1, info: 2 },
  );
});

test("flowsSummary: contagens dev/user/cross (edge_count de cada fluxo)", async () => {
  const { flowsSummary } = await import(NETWORK_VIEW_SPEC);
  assert.deepEqual(flowsSummary(FLOWS_FIXTURE), { dev: 4, user: 2, cross: 1 });
});
