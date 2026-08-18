/**
 * Export graph to draw.io (mxGraph) XML format.
 * Compatible with draw.io / diagrams.net.
 */

import type { Edge, Node } from "@xyflow/react";
import type { ArchEdgeData, CanvasNodeData, FlowKind, ZoneNodeData } from "./types";
import { isZoneData, isArchData } from "./types";

export function exportToDrawio(nodes: Node<CanvasNodeData>[], edges: Edge[]): string {
  const mxCell = (id: string, x: number, y: number, w: number, h: number, label: string, style: string, parent: string = "1"): string => {
    return `    <mxCell id="${id}" value="${escapeXml(label)}" style="${style}" parent="${parent}" vertex="1">\n      <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />\n    </mxCell>`;
  };

  const mxEdge = (id: string, source: string, target: string, label: string, style: string = ""): string => {
    const edgeStyle = style || "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
    return `    <mxCell id="${id}" style="${edgeStyle}" parent="1" source="${source}" target="${target}" edge="1">\n      ${label ? `<mxGeometry relative="1" as="geometry">\n        <mxPoint x="${(Number(label.split(":")[0]) || 0) * 50}" y="0" as="sourcePoint" />\n      </mxGeometry>` : `<mxGeometry relative="1" as="geometry" />`}\n    </mxCell>`;
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="764" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
`;

  const nodeMap = new Map<string, string>();

  for (const node of nodes) {
    const data = node.data as CanvasNodeData;
    const id = `node_${node.id}`;
    nodeMap.set(node.id, id);

    if (isZoneData(data)) {
      const zoneData = data as ZoneNodeData;
      const colors: Record<string, string> = {
        region: "strokeColor=#38bdf8;fillColor=#0c4a6e20;",
        vpc: "strokeColor=#a78bfa;fillColor=#3b076420;",
        availability_zone: "strokeColor=#34d399;fillColor=#053b2c20;",
        subnet_public: "strokeColor=#fbbf24;fillColor=#451a0320;",
        subnet_private: "strokeColor=#fb923c;fillColor=#43140720;",
        security_boundary: "strokeColor=#f472b6;fillColor=#83184320;",
        layer: "strokeColor=#818cf8;fillColor=#1e1b4b20;",
        plane: "strokeColor=#2dd4bf;fillColor=#134e4a20;",
        peering: "strokeColor=#67e8f9;fillColor=#08334420;",
        vpn: "strokeColor=#c4b5fd;fillColor=#2e106520;",
        privatelink: "strokeColor=#86efac;fillColor=#052e1620;",
        express_route: "strokeColor=#fdba74;fillColor=#43140720;",
      };
      const color = colors[zoneData.zoneKind] || "strokeColor=#64748b;fillColor=#0f172a20;";
      xml += mxCell(id, node.position.x, node.position.y, node.width || 420, node.height || 280, data.label || node.id, `${color}rounded=1;whiteSpace=wrap;html=1;`);
    } else if (isArchData(data)) {
      const config = data.config || {};
      const provider = config.provider || "";
      const service = config.service || "";
      const tech = data.tech || "";
      const label = data.label || node.id;
      const fullLabel = `${label}${tech ? `\n<font color='#94a3b8' size='10'>${tech}${provider ? ` · ${provider}` : ""}${service ? ` · ${service}` : ""}</font>` : ""}`;
      xml += mxCell(id, node.position.x, node.position.y, node.width || 220, node.height || 78, fullLabel, "rounded=1;whiteSpace=wrap;html=1;strokeColor=#334155;fillColor=#0f172a;");
    }
  }

  for (const edge of edges) {
    const srcId = nodeMap.get(edge.source);
    const tgtId = nodeMap.get(edge.target);
    if (!srcId || !tgtId) continue;

    const edata = (edge.data || {}) as ArchEdgeData;
    const label = edata.label ? `<font color='#94a3b8' size='10'>${edata.label}</font>` : "";
    const protocol = edata.protocol ? `<font color='#64748b' size='9'>[${edata.protocol}]</font>` : "";
    const edgeLabel = label ? `${label}<br/>${protocol}` : protocol;

    const flowColors: Record<FlowKind, string> = {
      sync: "strokeColor=#38bdf8;",
      async: "strokeColor=#fbbf24;dashed=1;",
      data: "strokeColor=#34d399;",
      control: "strokeColor=#f472b6;",
      management: "strokeColor=#818cf8;",
    };
    const colorStyle = edata.flowKind ? (flowColors[edata.flowKind] || "strokeColor=#64748b;") : "strokeColor=#64748b;";
    const criticalStyle = edata.isCriticalPath ? "strokeWidth=3;strokeColor=#f43f5e;" : "";
    xml += mxEdge(`edge_${edge.id}`, srcId, tgtId, edgeLabel, `${colorStyle}${criticalStyle}edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;`);
  }

  xml += `  </root>
</mxGraphModel>`;

  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
