/** P0.1.6 — Consistência cross-diagram entre vistas do pacote. */

import type { DiagramKind } from "./diagram-library";

export type DiagramSnapshot = {
  graphId: string;
  kind: DiagramKind | string | null;
  name: string;
  nodes: Array<{ id: string; data?: { label?: string; catalogId?: string; stableRef?: string } }>;
};

export type ConsistencyIssue = {
  severity: "warning" | "critical";
  stableRef: string;
  label: string;
  presentIn: string[];
  missingIn: string[];
  detail: string;
};

function stableRef(node: DiagramSnapshot["nodes"][0]): string {
  const d = node.data ?? {};
  return (d.stableRef || d.catalogId || d.label || node.id).toLowerCase().trim();
}

/** Compara serviços entre diagramas do mesmo projeto. */
export function analyzeDiagramConsistency(snapshots: DiagramSnapshot[]): ConsistencyIssue[] {
  if (snapshots.length < 2) return [];

  const byRef = new Map<string, { label: string; graphs: Set<string> }>();
  for (const snap of snapshots) {
    for (const n of snap.nodes) {
      const ref = stableRef(n);
      if (!ref) continue;
      const entry = byRef.get(ref) ?? { label: n.data?.label ?? ref, graphs: new Set() };
      entry.graphs.add(snap.graphId);
      byRef.set(ref, entry);
    }
  }

  const allGraphIds = snapshots.map((s) => s.graphId);
  const issues: ConsistencyIssue[] = [];

  for (const [ref, { label, graphs }] of byRef.entries()) {
    if (graphs.size === allGraphIds.length) continue;
    const presentIn = snapshots.filter((s) => graphs.has(s.graphId)).map((s) => s.name);
    const missingIn = snapshots.filter((s) => !graphs.has(s.graphId)).map((s) => s.name);
    issues.push({
      severity: missingIn.length >= allGraphIds.length - 1 ? "critical" : "warning",
      stableRef: ref,
      label,
      presentIn,
      missingIn,
      detail: `«${label}» aparece em ${presentIn.join(", ")} mas falta em ${missingIn.join(", ")}.`,
    });
  }

  return issues.sort((a, b) => (a.severity === "critical" ? -1 : 1));
}
