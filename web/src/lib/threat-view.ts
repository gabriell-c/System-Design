import type { Finding, Severity, ThreatAnalysisResult } from "./types";

/**
 * R7 (plano threat) — lógica pura do painel de Ameaças (JSX-free, testável
 * sob `node --test`; mesmo padrão de cost-view.ts/select-nav.ts). Teste:
 * threat-view.test.ts.
 */

/** Reaproveitado do cost-view (R7: 429 usa a MESMA mensagem). */
export { rateLimitMessage } from "./cost-view";

export type ThreatModelKey = "stride" | "linddun" | "generic";

export interface ThreatModelSection {
  severity: Severity;
  label: string;
  findings: Finding[];
}

export interface ThreatModelGroup {
  key: ThreatModelKey;
  label: string;
  /** Só as severidades com finding, em ordem crítica → aviso → info. */
  sections: ThreatModelSection[];
}

const MODEL_ORDER: ThreatModelKey[] = ["stride", "linddun", "generic"];

const MODEL_LABELS: Record<ThreatModelKey, string> = {
  stride: "STRIDE",
  linddun: "LINDDUN",
  generic: "Sem modelo",
};

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Críticas",
  warning: "Alertas",
  info: "Informações",
};

function modelKeyOf(finding: Finding): ThreatModelKey {
  return finding.model === "stride" || finding.model === "linddun" ? finding.model : "generic";
}

/**
 * Agrupa `result.findings` por `finding.model` (STRIDE → LINDDUN → sem
 * modelo) e, dentro de cada modelo, por severidade (crítica → aviso →
 * info). Grupos/severidades vazios somem da lista (o painel só pinta o
 * que existe).
 */
export function groupByModelAndSeverity(result: ThreatAnalysisResult): ThreatModelGroup[] {
  const buckets = new Map<ThreatModelKey, Map<Severity, Finding[]>>();
  for (const finding of result.findings) {
    const key = modelKeyOf(finding);
    const bySeverity = buckets.get(key) ?? new Map<Severity, Finding[]>();
    const list = bySeverity.get(finding.severity) ?? [];
    list.push(finding);
    bySeverity.set(finding.severity, list);
    buckets.set(key, bySeverity);
  }
  return MODEL_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: MODEL_LABELS[key],
    sections: SEVERITY_ORDER.filter((severity) => buckets.get(key)?.has(severity)).map((severity) => ({
      severity,
      label: SEVERITY_LABELS[severity],
      findings: buckets.get(key)!.get(severity)!,
    })),
  }));
}

/** Contagem por severidade (crítico/aviso/info) — total é `findings.length`. */
export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

/**
 * Canvas sujo (document-slice `dirty` OU save-slice `saveStatus ===
 * "dirty"` — MESMA ruling do CostPanel/ResiliencePanel) → resultados
 * baseados no último grafo salvo.
 */
export function isStale(dirty: boolean, saveStatus: string): boolean {
  return dirty || saveStatus === "dirty";
}

/** Botão "Recalcular com canvas" visível SÓ com canvas sujo (R7). */
export function showRecalculate(dirty: boolean, saveStatus: string): boolean {
  return isStale(dirty, saveStatus);
}

/** "Aplicar fix" aparece SÓ com `fix_action` presente (null/ausente → não). */
export function fixVisible(finding: Finding): boolean {
  return finding.fix_action != null;
}

/**
 * Texto de empty state HONESTO (R7): repete o resumo dos checks e avisa
 * que heurística é triagem — não substitui threat model formal.
 */
export function emptyStateText(checksSummary: string, version: string): string {
  return `${checksSummary} — heurística é triagem, não substitui threat model formal (v${version}).`;
}
