import type { DeploymentFlowsResult, NetworkPolicyFinding } from "./types";

/**
 * R8 (plano threat) — lógica pura do painel de Rede (JSX-free, testável
 * sob `node --test`; mesmo padrão de cost-view.ts/select-nav.ts). Teste:
 * network-view.test.ts.
 */

export type NetworkScoreLabel = "Boa" | "Atenção" | "Crítica";

/**
 * Score 0-100 → rótulo (R8: ≥90 Boa / 70-89 Atenção / <70 Crítica).
 */
export function scoreLabel(score: number): NetworkScoreLabel {
  if (score >= 90) return "Boa";
  if (score >= 70) return "Atenção";
  return "Crítica";
}

/** Contagem de findings da política de rede por severidade. */
export function findingsCounts(findings: NetworkPolicyFinding[]): {
  critical: number;
  warning: number;
  info: number;
} {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

/** Contagens dos fluxos de deploy (arestas: edge_count de cada fluxo). */
export function flowsSummary(res: DeploymentFlowsResult): { dev: number; user: number; cross: number } {
  return { dev: res.dev_flow.edge_count, user: res.user_flow.edge_count, cross: res.cross_flow.edge_count };
}
