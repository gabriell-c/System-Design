import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// src/lib → web/test/ts-ext-hooks.mjs (2 níveis acima).
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

/**
 * R7 — lógica pura do painel de Ameaças (sem JSX, importável sob
 * strip-types; o JSX é validado por tsc no gate). Mesmo padrão do
 * cost-view.test.ts: alias `@/` resolvido pelo ts-ext-hooks.
 */

const THREAT_VIEW_SPEC = "@/lib/threat-view";

function finding(partial: Partial<import("@/lib/types").Finding> = {}): import("@/lib/types").Finding {
  return {
    severity: "info",
    title: "t",
    detail: "d",
    ...partial,
  };
}

const RESULT: import("@/lib/types").ThreatAnalysisResult = {
  findings: [
    finding({ node_id: "n1", severity: "critical", model: "stride", title: "C1" }),
    finding({ node_id: "n2", severity: "warning", model: "stride", title: "A1" }),
    finding({ severity: "warning", model: "linddun", title: "A2" }),
    finding({ severity: "critical", model: "linddun", title: "C2", fix_action: { action_type: "add", label: "WAF", payload: {} } }),
    finding({ severity: "info", title: "I1" }), // sem `model` → seção genérica
    finding({ severity: "info", model: null, title: "I2" }), // `null` → também genérica
  ],
  total: 6,
  by_severity: { critical: 2, warning: 2, info: 2 },
  summary: "s",
  version: "threat-v2",
};

test("groupByModelAndSeverity: STRIDE → LINDDUN → sem modelo; severidade crítica → aviso → info", async () => {
  const { groupByModelAndSeverity } = await import(THREAT_VIEW_SPEC);
  const groups = groupByModelAndSeverity(RESULT);
  assert.deepEqual(
    groups.map((g) => g.key),
    ["stride", "linddun", "generic"],
    "ordem dos modelos (sem modelo por último)",
  );
  assert.deepEqual(
    groups.map((g) => g.label),
    ["STRIDE", "LINDDUN", "Sem modelo"],
    "labels pt-BR dos grupos",
  );
  const [stride, linddun, generic] = groups;
  assert.deepEqual(
    stride.sections.map((s) => [s.severity, s.findings.map((f) => f.title)]),
    [
      ["critical", ["C1"]],
      ["warning", ["A1"]],
    ],
    "STRIDE: só as severidades presentes, em ordem crítica→aviso",
  );
  assert.deepEqual(
    linddun.sections.map((s) => s.findings.map((f) => f.title)),
    [["C2"], ["A2"]],
    "uma seção por severidade (crítica→aviso)",
  );
  assert.deepEqual(
    generic.sections.map((s) => s.findings.map((f) => f.title)),
    [["I1", "I2"]],
    "findings sem `model` (ausente ou null) → seção genérica",
  );
});

test("groupByModelAndSeverity: findings vazios → zero grupos (nada de seções fantasma)", async () => {
  const { groupByModelAndSeverity } = await import(THREAT_VIEW_SPEC);
  assert.deepEqual(groupByModelAndSeverity({ ...RESULT, findings: [] }), []);
});

test("countBySeverity: contagem crítica/aviso/info", async () => {
  const { countBySeverity } = await import(THREAT_VIEW_SPEC);
  assert.deepEqual(countBySeverity(RESULT.findings), { critical: 2, warning: 2, info: 2 });
  assert.deepEqual(countBySeverity([]), { critical: 0, warning: 0, info: 0 });
});

test("isStale/showRecalculate: sujo no document-slice OU no save-slice (ruling CostPanel)", async () => {
  const { isStale, showRecalculate } = await import(THREAT_VIEW_SPEC);
  assert.equal(isStale(true, "saved"), true, "dirty (document-slice)");
  assert.equal(isStale(false, "dirty"), true, "saveStatus dirty (save-slice)");
  assert.equal(isStale(false, "saving"), false, "saving não é sujo");
  assert.equal(isStale(false, "error"), false);
  // Botão "Recalcular com canvas" segue a MESMA regra do banner (R7).
  assert.equal(showRecalculate(true, "saved"), true);
  assert.equal(showRecalculate(false, "dirty"), true);
  assert.equal(showRecalculate(false, "saved"), false);
});

test("fixVisible: só com fix_action presente (null/ausente → falso)", async () => {
  const { fixVisible } = await import(THREAT_VIEW_SPEC);
  assert.equal(fixVisible(finding({ fix_action: { action_type: "add", label: "WAF", payload: {} } })), true);
  assert.equal(fixVisible(finding()), false, "ausente");
  assert.equal(fixVisible(finding({ fix_action: null })), false, "null");
});

test("emptyStateText: resumo dos checks + aviso de triagem (texto travado)", async () => {
  const { emptyStateText } = await import(THREAT_VIEW_SPEC);
  assert.equal(
    emptyStateText("Os 24 checks heurísticos não detectaram ameaças", "threat-v2"),
    "Os 24 checks heurísticos não detectaram ameaças — heurística é triagem, não substitui threat model formal (vthreat-v2).",
  );
});

test("rateLimitMessage: reexportado do cost-view (429 — MESMA mensagem do CostPanel)", async () => {
  const mod = await import(THREAT_VIEW_SPEC);
  assert.equal(mod.rateLimitMessage(60), "Limite de requisições atingido — tente novamente em ~60s.");
});
