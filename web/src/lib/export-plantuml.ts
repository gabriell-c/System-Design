/**
 * Export graph to PlantUML format.
 * See https://plantuml.com
 */

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, ZoneNodeData } from "./types";
import { isZoneData, isArchData } from "./types";

export function exportToPlantuml(nodes: Node<CanvasNodeData>[], edges: Edge[], projectName = "Architecture"): string {
  const lines: string[] = [];
  lines.push(`@startuml ${projectName}`);
  lines.push('skinparam linetype ortho');
  lines.push('skinparam sequenceArrowThickness 1');
  lines.push('skinparam maxMessageSize 200');
  lines.push("");

  const nodeMap = new Map<string, string>();

  // Define nodes
  for (const node of nodes) {
    const data = node.data as CanvasNodeData;
    const plantumlId = `node_${node.id}`.replace(/-/g, "_");
    nodeMap.set(node.id, plantumlId);

    if (isZoneData(data)) {
      const zoneData = data as ZoneNodeData;
      lines.push(`package "${data.label || node.id}" as ${plantumlId} {`);
      lines.push(`  [${zoneData.zoneKind.toUpperCase()}]`);
      lines.push("}");
    } else if (isArchData(data)) {
      const config = data.config || {};
      const tech = data.tech || "";
      const label = data.label || node.id;
      const description = tech ? `\\n(${tech})` : "";
      lines.push(`[${label}${description}] as ${plantumlId}`);
    }
  }

  // Define edges
  for (const edge of edges) {
    const srcId = nodeMap.get(edge.source);
    const tgtId = nodeMap.get(edge.target);
    if (!srcId || !tgtId) continue;

    const data = edge.data || {};
    const label = data.label || "";
    const protocol = data.protocol ? `[${data.protocol}]` : "";
    const edgeLabel = label ? `${label} ${protocol}` : protocol;
    const arrowType = data.flowKind === "async" ? "-->" : "->";

    if (edgeLabel) {
      lines.push(`${srcId} ${arrowType} ${tgtId} : ${edgeLabel}`);
    } else {
      lines.push(`${srcId} ${arrowType} ${tgtId}`);
    }
  }

  lines.push("@enduml");
  return lines.join("\n");
}
