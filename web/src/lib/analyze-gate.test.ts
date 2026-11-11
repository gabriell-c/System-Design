import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_ANALYZE_COOLDOWN_MS,
  AUTO_ANALYZE_DEBOUNCE_MS,
  AUTO_ANALYZE_RETRY_MIN_GAP_MS,
  AUTO_BUDGET_EXHAUSTED_NOTICE,
  isAutoBudgetExhausted,
  isManualBudgetExhausted,
  retryGateOpen,
  shouldRunAutoAnalysis,
} from "./analyze-gate.ts";

const T0 = 1_000_000;

const DETAIL_AUTO_EXHAUSTED = "Orçamento diário de auto-análise esgotado";
const DETAIL_MANUAL_EXHAUSTED = "Orçamento diário de análises esgotado";

test("constantes têm os valores contratados", () => {
  assert.equal(AUTO_ANALYZE_COOLDOWN_MS, 60_000);
  assert.equal(AUTO_ANALYZE_RETRY_MIN_GAP_MS, 5 * 60_000);
  assert.equal(AUTO_ANALYZE_DEBOUNCE_MS, 2_000);
  assert.match(AUTO_BUDGET_EXHAUSTED_NOTICE, /Auto-análise desligada para hoje/);
});

test("cooldown bloqueia: menos de 60s desde o início da última auto-execução", () => {
  assert.equal(
    shouldRunAutoAnalysis({
      lastRunAt: T0,
      lastFingerprint: "fp-a",
      now: T0 + AUTO_ANALYZE_COOLDOWN_MS - 1,
      fingerprint: "fp-b",
      autoDisabled: false,
    }),
    false,
  );
  // exatamente 60s depois, com fingerprint mudado, passa
  assert.equal(
    shouldRunAutoAnalysis({
      lastRunAt: T0,
      lastFingerprint: "fp-a",
      now: T0 + AUTO_ANALYZE_COOLDOWN_MS,
      fingerprint: "fp-b",
      autoDisabled: false,
    }),
    true,
  );
});

test("fingerprint inalterado bloqueia mesmo fora do cooldown", () => {
  assert.equal(
    shouldRunAutoAnalysis({
      lastRunAt: T0,
      lastFingerprint: "fp-a",
      now: T0 + AUTO_ANALYZE_COOLDOWN_MS + 5_000,
      fingerprint: "fp-a",
      autoDisabled: false,
    }),
    false,
  );
});

test("primeira execução (lastRunAt null) roda sem restrição de fingerprint", () => {
  assert.equal(
    shouldRunAutoAnalysis({
      lastRunAt: null,
      lastFingerprint: null,
      now: T0,
      fingerprint: "fp-a",
      autoDisabled: false,
    }),
    true,
  );
});

test("429 auto esgotado desliga a auto-análise para a sessão (autoDisabled)", () => {
  assert.equal(isAutoBudgetExhausted(DETAIL_AUTO_EXHAUSTED), true);
  const disabled = isAutoBudgetExhausted(DETAIL_AUTO_EXHAUSTED);
  assert.equal(
    shouldRunAutoAnalysis({
      lastRunAt: null,
      lastFingerprint: null,
      now: T0,
      fingerprint: "fp-x",
      autoDisabled: disabled,
    }),
    false,
    "com a sessão desligada o gate nunca libera, mesmo sem cooldown/fingerprint",
  );
});

test("429 manual (análises esgotado) NÃO afeta a auto-análise", () => {
  assert.equal(isManualBudgetExhausted(DETAIL_MANUAL_EXHAUSTED), true);
  assert.equal(isAutoBudgetExhausted(DETAIL_MANUAL_EXHAUSTED), false, "o detalhe manual não ativa o lockout de auto");
  // nenhum lockout de sessão → gate segue só cooldown/fingerprint
  assert.equal(
    shouldRunAutoAnalysis({
      lastRunAt: null,
      lastFingerprint: null,
      now: T0,
      fingerprint: "fp-x",
      autoDisabled: false,
    }),
    true,
  );
});

test("detalhes fora dos orçamentos não disparam nenhum lockout", () => {
  assert.equal(isAutoBudgetExhausted("rate limit"), false);
  assert.equal(isManualBudgetExhausted("rate limit"), false);
  assert.equal(isAutoBudgetExhausted(DETAIL_MANUAL_EXHAUSTED), false);
  assert.equal(isManualBudgetExhausted(DETAIL_AUTO_EXHAUSTED), false, "o detalhe auto não é o manual");
});

test("retryGateOpen: falha abre gap próprio (5x cooldown) antes da nova tentativa", () => {
  assert.equal(retryGateOpen(T0, null), true, "sem falha em aberto, liberado");
  const failedAt = T0 + 1_000;
  assert.equal(retryGateOpen(failedAt + AUTO_ANALYZE_RETRY_MIN_GAP_MS - 1, failedAt), false);
  assert.equal(retryGateOpen(failedAt + AUTO_ANALYZE_RETRY_MIN_GAP_MS, failedAt), true);
});
