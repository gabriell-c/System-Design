/** P0.2.6 — Highlight do caminho crítico no grafo. */

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";
import { normalizeEdgeData } from "./edges";

export type CriticalPathResult = {
  edgeIds: string[];
  nodeIds: string[];
};

/** Arestas marcadas isCriticalPath + nós source/target. */
export function computeCriticalPath(nodes: Node<CanvasNodeData>[], edges: Edge[]): CriticalPathResult {
  const edgeIds: string[] = [];
  const nodeSet = new Set<string>();

  for (const e of edges) {
    const d = normalizeEdgeData(e.data);
    if (d.isCriticalPath) {
      edgeIds.push(e.id);
      nodeSet.add(e.source);
      nodeSet.add(e.target);
    }
  }

  const nfrCritical = edges
    .filter((e) => edgeIds.includes(e.id) === false)
    .filter((e) => normalizeEdgeData(e.data).flowNumber != null)
    .sort((a, b) => (normalizeEdgeData(a.data).flowNumber ?? 0) - (normalizeEdgeData(b.data).flowNumber ?? 0));

  if (edgeIds.length === 0 && nfrCritical.length > 0) {
    for (const e of nfrCritical.slice(0, 5)) {
      edgeIds.push(e.id);
      nodeSet.add(e.source);
      nodeSet.add(e.target);
    }
  }

  return { edgeIds, nodeIds: [...nodeSet] };
}
