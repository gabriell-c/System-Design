import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// src/components/ui → web/test/ts-ext-hooks.mjs (3 níveis acima).
register(new URL("../../../test/ts-ext-hooks.mjs", import.meta.url));

/**
 * S3b (item 69) — CRÍTICO: o listbox do `ui/Select` tinha `tabIndex={-1}` e
 * nunca recebia focus → ArrowUp/Down/Enter eram inalcançáveis. O fix move o
 * focus para o listbox ao abrir (`listboxRef.current?.focus()`) e devolve ao
 * trigger ao fechar (só quando o foco ainda está dentro do widget).
 *
 * RULING (documentado): o wiring de DOM/focus não é testável sob
 * `node --test` sem um DOM (o script atual não tem RTL/jsdom) → o cálculo
 * PURO da navegação vive em `src/lib/select-nav.ts` (sem JSX, para rodar
 * sob strip-types) e é o que este teste cobre; a parte React é validada
 * por tsc no gate.
 */

// O helper vive em src/lib/ (o Select.tsx importa via `@/lib/select-nav`) —
// o alias é resolvido pelo mesmo ts-ext-hooks (mesmo caminho do
// useSimulation.test.ts do S3a).
const SELECT_NAV_SPEC = "@/lib/select-nav";

test("select-nav: moveHighlight clampa em [0, count-1]", async () => {
  const { moveHighlight } = await import(SELECT_NAV_SPEC);
  assert.equal(moveHighlight(0, 1, 5), 1, "sobe do 0");
  assert.equal(moveHighlight(4, 1, 5), 4, "não passa do fim");
  assert.equal(moveHighlight(0, -1, 5), 0, "não fica negativo");
  assert.equal(moveHighlight(3, -1, 5), 2, "desce do meio");
  assert.equal(moveHighlight(0, 1, 0), 0, "lista vazia → 0 (sem crash)");
  assert.equal(moveHighlight(0, -1, 1), 0, "item único → 0");
});

test("select-nav: importável sob strip-types (JSX-free, requisito do fix)", async () => {
  const mod = await import(SELECT_NAV_SPEC);
  assert.equal(typeof mod.moveHighlight, "function");
});
