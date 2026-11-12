import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// src/lib → web/test/ts-ext-hooks.mjs (2 níveis acima).
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

/**
 * R8 — lógica pura do painel de Custos (sem JSX, importável sob
 * strip-types; o JSX é validado por tsc no gate). Mesmo padrão do
 * select.test.ts: alias `@/` resolvido pelo ts-ext-hooks.
 */

const COST_VIEW_SPEC = "@/lib/cost-view";

/** Fixture do shape novo (R2/R4 — sem tier/by_tier/heuristic). */
const COST_FIXTURE: import("@/lib/types").CostBreakdown = {
  line_items: [
    {
      node_id: "n1",
      label: 'Api; "core"',
      catalog_id: "aws-lb",
      region: "us-east-1",
      cost_key: "Lambda:small-project",
      cost_usd_month: 7.5,
      priced: true,
    },
    {
      node_id: "n2",
      label: "DB",
      catalog_id: "custom-db",
      region: "Não definida",
      cost_key: "—",
      cost_usd_month: 0,
      priced: false,
    },
  ],
  total_usd_month: 7.5,
  by_region: { "us-east-1": 7.5 },
  node_count: 2,
  priced_count: 1,
  price_table_version: "2025-static-v1",
  summary: "s",
};

test("formatUsd: Intl pt-BR USD, 2 casas (valores travados no Node 20 full-icu)", async () => {
  const { formatUsd } = await import(COST_VIEW_SPEC);
  // O separador entre símbolo e valor é U+00A0 (non-breaking space) — travado
  // explicitamente para não regredir para espaço simples.
  assert.equal(formatUsd(55), "US$ 55,00");
  assert.equal(formatUsd(0), "US$ 0,00");
  assert.equal(formatUsd(1234.5), "US$ 1.234,50");
});

test("pctShare: 0..100 com 1 casa; total 0 → 0; clampa em 100", async () => {
  const { pctShare } = await import(COST_VIEW_SPEC);
  assert.equal(pctShare(50, 200), 25);
  assert.equal(pctShare(100, 100), 100);
  assert.equal(pctShare(1, 3), 33.3);
  assert.equal(pctShare(0, 0), 0, "total 0 → 0 (sem NaN/Infinity)");
  assert.equal(pctShare(0, 100), 0);
  assert.equal(pctShare(-5, 100), 0, "clampa em 0");
  assert.equal(pctShare(200, 100), 100, "clampa em 100");
});

test("buildCostCsv: BOM + separador ; + escapes de ;/aspas (Excel pt-BR)", async () => {
  const { buildCostCsv } = await import(COST_VIEW_SPEC);
  const csv = buildCostCsv(COST_FIXTURE);
  assert.equal(csv.charCodeAt(0), 0xfeff, "BOM na posição 0");
  const lines = csv.slice(1).split("\n");
  assert.equal(lines[0], "nó;serviço;catalog;região;preço_chave;usd_mês;precificado", "header");
  // Ruling: números invariáveis (String(n) — ponto decimal) para evitar
  // ambiguidade de locale em Excel pt-BR; campo com `;` e aspas → citado
  // com aspas dobradas.
  assert.equal(lines[1], 'n1;"Api; ""core""";aws-lb;us-east-1;Lambda:small-project;7.5;true');
  assert.equal(lines[2], "n2;DB;custom-db;Não definida;—;0;false");
  // Ruling: linha de total — nome na col 1, valor na col 6 (usd_mês), vazio no resto.
  assert.equal(lines[3], "total;;;;;7.5;");
  assert.equal(lines.length, 4, "1 header + N items + 1 total");
});

test("rateLimitMessage: 429 com retryAfter (segundos)", async () => {
  const { rateLimitMessage } = await import(COST_VIEW_SPEC);
  assert.equal(
    rateLimitMessage(45),
    "Limite de requisições atingido — tente novamente em ~45s.",
  );
  assert.equal(rateLimitMessage(60).endsWith("~60s."), true);
});

test("downloadCsv: existe e o guard SSR não crasha em Node (document ausente)", async () => {
  const mod = await import(COST_VIEW_SPEC);
  assert.equal(typeof mod.downloadCsv, "function");
  assert.equal(typeof document, "undefined", "pré-condição: rodando em Node sem DOM");
  mod.downloadCsv("custos-test.csv", "a;b");
  assert.equal(mod.downloadCsv("x.csv", ""), undefined, "retorna silenciosamente sem DOM");
});
