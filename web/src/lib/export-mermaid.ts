/**
 * Export graph to Mermaid flowchart format.
 * See https://mermaid.js.org
 */

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, ZoneNodeData } from "./types";
import { isZoneData, isArchData } from "./types";

export function exportToMermaid(nodes: Node<CanvasNodeData>[], edges: Edge[], projectName = "Architecture"): string {
  const lines: string[] = [];
  lines.push("flowchart TB");
  lines.push("    subgraph nodes [Nodes]");

  const nodeMap = new Map<string, string>();

  for (const node of nodes) {
    const data = node.data as CanvasNodeData;
    const mermaidId = `node_${node.id.replace(/-/g, "_")}`;
    nodeMap.set(node.id, mermaidId);

    if (isZoneData(data)) {
      const zoneData = data as ZoneNodeData;
      const zoneId = `zone_${zoneData.zoneKind}`;
      lines.push(`        subgraph ${zoneId} ["${data.label || node.id}"]`);
      lines.push(`            direction TB`);
      lines.push(`            classDef zone fill:#0f172a,stroke:#334155,color:#94a3b8`);
      lines.push(`            class ${zoneId} zone`);
      lines.push("        end");
    } else if (isArchData(data)) {
      const config = data.config || {};
      const tech = data.tech || "";
      const label = data.label || node.id;
      const displayName = tech ? `${label}<br/><sub>${tech}</sub>` : label;
      lines.push(`        ${mermaidId}["${displayName}"]`);
    }
  }

  lines.push("    end");

  for (const edge of edges) {
    const srcId = nodeMap.get(edge.source);
    const tgtId = nodeMap.get(edge.target);
    if (!srcId || !tgtId) continue;

    const data = edge.data || {};
    const label = data.label || "";
    const protocol = data.protocol ? `|${data.protocol}|` : "";
    const criticalClass = data.isCriticalPath ? " class critical" : "";
    const linkStyle = data.flowKind === "async" ? "-.-.-" : "--";

    if (label) {
      lines.push(`    ${srcId} ${linkStyle}${protocol} ${tgtId}${criticalClass} : "${label}"`);
    } else {
      lines.push(`    ${srcId} ${linkStyle}${protocol} ${tgtId}${criticalClass}`);
    }
  }

  lines.push("");
  lines.push("    classDef critical stroke:#f43f5e,stroke-width:2px,fill:#1e1b4b,color:#fda4af");
  lines.push("");

  return lines.join("\n");
}
