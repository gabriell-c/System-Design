/**
 * ITEM 36 — Gate de auto-análise (funções puras, testáveis sem React).
 *
 * Auto-análise só roda quando:
 *  (a) passaram ao menos AUTO_ANALYZE_COOLDOWN_MS desde o INÍCIO da última
 *      execução automática (o próprio cooldown é o intervalo mínimo entre
 *      inícios — "retry min gap" entre tentadas de sucesso),
 *  (b) o fingerprint da análise (structureKey + context + nfr) mudou desde a
 *      última auto-análise,
 *  (c) a auto-análise não está desligada para a sessão (ex.: orçamento
 *      diário esgotado — ver isAutoBudgetExhausted).
 *
 * Falhas transitórias têm um gap próprio (AUTO_ANALYZE_RETRY_MIN_GAP_MS)
 * para não martelar o backend em cada mudança estrutural: ver retryGateOpen.
 */

/** Intervalo mínimo entre o início de duas execuções automáticas. */
export const AUTO_ANALYZE_COOLDOWN_MS = 60_000;

/**
 * Depois de uma auto-análise FALHADA (erro transitório, sem lockout de
 * orçamento), a próxima tentativa automática só ocorre após este intervalo.
 * É 5x o cooldown: falha não justifica o mesmo ritmo de mudança estrutural.
 */
export const AUTO_ANALYZE_RETRY_MIN_GAP_MS = 5 * AUTO_ANALYZE_COOLDOWN_MS;

/** Debounce entre a mudança estrutural e a auto-análise disparada. */
export const AUTO_ANALYZE_DEBOUNCE_MS = 2_000;

/**
 * Marcadores do `detail` dos 429 do backend (contrato wave-2):
 * auto → "Orçamento diário de auto-análise esgotado";
 * manual → "Orçamento diário de análises esgotado".
 * Nota: "auto-análise esgotado" (singular) não contém "análises esgotado"
 * (plural) — os dois marcadores são distinguíveis por includes.
 */
const AUTO_BUDGET_EXHAUSTED_MARKER = "auto-análise esgotado";
const MANUAL_BUDGET_EXHAUSTED_MARKER = "análises esgotado";

/** Aviso único de UI quando o orçamento diário de auto-análise esgota. */
export const AUTO_BUDGET_EXHAUSTED_NOTICE =
  "Auto-análise desligada para hoje (orçamento diário esgotado)";

/** Detalhe de 429 indica orçamento diário de auto-análise esgotado? */
export function isAutoBudgetExhausted(detail: string): boolean {
  return detail.includes(AUTO_BUDGET_EXHAUSTED_MARKER);
}

/** Detalhe de 429 indica orçamento diário de análises (manual) esgotado? */
export function isManualBudgetExhausted(detail: string): boolean {
  return !isAutoBudgetExhausted(detail) && detail.includes(MANUAL_BUDGET_EXHAUSTED_MARKER);
}

export type AutoAnalyzeGateInput = {
  /** Início da última execução automática (null = nunca rodou). */
  lastRunAt: number | null;
  /** Fingerprint da última auto-análise (null = nunca rodou). */
  lastFingerprint: string | null;
  /** Relógio injetado (testabilidade). */
  now: number;
  /** Fingerprint atual do editor. */
  fingerprint: string;
  /** Sessão desligou a auto-análise (ex.: orçamento diário esgotado). */
  autoDisabled: boolean;
};

/** Gate principal: a auto-análise deve rodar agora? (regras a+b+c acima). */
export function shouldRunAutoAnalysis(input: AutoAnalyzeGateInput): boolean {
  if (input.autoDisabled) return false;
  if (input.lastRunAt === null) return true;
  if (input.now - input.lastRunAt < AUTO_ANALYZE_COOLDOWN_MS) return false;
  if (input.lastFingerprint === input.fingerprint) return false;
  return true;
}

/**
 * Gate de retry pós-falha: a próxima tentativa automática está liberada?
 * `lastFailedAt` null = nenhuma falha em aberto (sempre liberado; o cooldown
 * de shouldRunAutoAnalysis ainda vale).
 */
export function retryGateOpen(now: number, lastFailedAt: number | null): boolean {
  return lastFailedAt === null || now - lastFailedAt >= AUTO_ANALYZE_RETRY_MIN_GAP_MS;
}
