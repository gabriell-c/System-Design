/**
 * P2.2.5 — Diff visual no canvas (verde/vermelho).
 *
 * Marca nós e arestas que mudaram entre versões:
 * - added: verde (#22c55e)
 * - removed: vermelho (#ef4444)
 * - changed: amarelo (#eab308)
 * - unchanged: cinza padrão
 */

export type DiffNodeStatus = "added" | "removed" | "changed" | "unchanged";
export type DiffEdgeStatus = "added" | "removed" | "unchanged";

export type DiffHighlight = {
  nodeId?: string;
  edgeId?: string;
  status: DiffNodeStatus | DiffEdgeStatus;
};

/** Status -> cor do border do nó */
export const NODE_STATUS_COLOR: Record<DiffNodeStatus, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  changed: "#eab308",
  unchanged: "#334155",
};

/** Status -> cor do stroke da aresta */
export const EDGE_STATUS_COLOR: Record<DiffEdgeStatus, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  unchanged: "#475569",
};

export type DiffResult = {
  added_node_ids: string[];
  removed_node_ids: string[];
  changed_node_ids: string[];
  added_edge_ids: string[];
  removed_edge_ids: string[];
};

/** Converte resultado da API em highlight map */
export function buildDiffHighlights(diff: DiffResult): DiffHighlight[] {
  const highlights: DiffHighlight[] = [];
  for (const id of diff.added_node_ids) {
    highlights.push({ nodeId: id, status: "added" });
  }
  for (const id of diff.removed_node_ids) {
    highlights.push({ nodeId: id, status: "removed" });
  }
  for (const id of diff.changed_node_ids) {
    highlights.push({ nodeId: id, status: "changed" });
  }
  for (const id of diff.added_edge_ids) {
    highlights.push({ edgeId: id, status: "added" });
  }
  for (const id of diff.removed_edge_ids) {
    highlights.push({ edgeId: id, status: "removed" });
  }
  return highlights;
}

export function nodeHighlightColor(nodeId: string | undefined, highlights: DiffHighlight[]): string | null {
  if (!nodeId) return null;
  const h = highlights.find((h) => h.nodeId === nodeId);
  if (!h) return null;
  return NODE_STATUS_COLOR[h.status as DiffNodeStatus];
}

export function edgeHighlightColor(edgeId: string | undefined, highlights: DiffHighlight[]): string | null {
  if (!edgeId) return null;
  const h = highlights.find((h) => h.edgeId === edgeId);
  if (!h) return null;
  return EDGE_STATUS_COLOR[h.status as DiffEdgeStatus];
}
