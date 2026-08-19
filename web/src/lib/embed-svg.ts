/**
 * P3.2.2 — Renderiza diagrama como SVG puro (sem React Flow).
 * Usado para embed em Notion/Confluence com tema claro.
 */
import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "./types";

export type EmbedOptions = {
  theme?: "light" | "dark";
  width?: number;
  height?: number;
  showControls?: boolean;
  showBackground?: boolean;
};

export type SvgEmbedResult = {
  svg: string;
  width: number;
  height: number;
  iframeSnippet: string;
};

const NODE_WIDTH = 210;
const NODE_HEIGHT = 80;
const ZONE_PADDING = 20;

function getDefaultColor(kind: string): { bg: string; border: string; text: string } {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    backend: { bg: "#1e293b", border: "#3b82f6", text: "#e2e8f0" },
    frontend: { bg: "#1e293b", border: "#8b5cf6", text: "#e2e8f0" },
    database: { bg: "#1e293b", border: "#10b981", text: "#e2e8f0" },
    cloud: { bg: "#1e293b", border: "#f59e0b", text: "#e2e8f0" },
    identity: { bg: "#1e293b", border: "#ef4444", text: "#e2e8f0" },
    observability: { bg: "#1e293b", border: "#06b6d4", text: "#e2e8f0" },
    integration: { bg: "#1e293b", border: "#a855f7", text: "#e2e8f0" },
    security: { bg: "#1e293b", border: "#f43f5e", text: "#e2e8f0" },
    deploy: { bg: "#1e293b", border: "#22c55e", text: "#e2e8f0" },
    zone: { bg: "transparent", border: "#475569", text: "#94a3b8" },
  };
  return colors[kind] ?? colors.backend;
}

export function renderEmbedSvg(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  options: EmbedOptions = {},
): SvgEmbedResult {
  const { theme = "light", width = 1200, height = 800 } = options;
  const isLight = theme === "light";

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + (node.width ?? NODE_WIDTH));
    maxY = Math.max(maxY, node.position.y + (node.height ?? NODE_HEIGHT));
  }

  const padding = 40;
  const svgWidth = Math.max(width, maxX - minX + padding * 2);
  const svgHeight = Math.max(height, maxY - minY + padding * 2);

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;

  // Background
  svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="${isLight ? "#f8fafc" : "#0f172a"}"/>`;

  // Draw edges first (behind nodes)
  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);
    if (!source || !target) continue;

    const sx = source.position.x + NODE_WIDTH / 2;
    const sy = source.position.y + NODE_HEIGHT / 2;
    const tx = target.position.x + NODE_WIDTH / 2;
    const ty = target.position.y + NODE_HEIGHT / 2;

    svg += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="${isLight ? "#94a3b8" : "#475569"}" stroke-width="1.5" stroke-dasharray="4,2"/>`;

    // Arrow head
    const angle = Math.atan2(ty - sy, tx - sx);
    const arrowLen = 6;
    svg += `<polygon points="${tx},${ty} ${tx - arrowLen * Math.cos(angle - Math.PI / 6)},${ty - arrowLen * Math.sin(angle - Math.PI / 6)} ${tx - arrowLen * Math.cos(angle + Math.PI / 6)},${ty - arrowLen * Math.sin(angle + Math.PI / 6)}" fill="${isLight ? "#94a3b8" : "#475569"}"/>`;
  }

  // Draw nodes
  for (const node of nodes) {
    const data = node.data as CanvasNodeData;
    const x = node.position.x + padding;
    const y = node.position.y + padding;
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? NODE_HEIGHT;

    const colors = getDefaultColor(data.kind);
    const fillColor = isLight
      ? colors.bg.replace("#", "") === "1e293b" ? "#ffffff" : colors.bg
      : colors.bg;

    svg += `<g transform="translate(${x}, ${y})">`;
    svg += `<rect width="${w}" height="${h}" rx="8" fill="${fillColor}" stroke="${colors.border}" stroke-width="1.5"/>`;

    // Icon placeholder
    svg += `<circle cx="24" cy="${h / 2}" r="12" fill="${colors.border}20"/>`;

    // Label
    svg += `<text x="${48}" y="${h / 2 - 6}" fill="${isLight ? "#1e293b" : "#f1f5f9"}" font-size="12" font-weight="600" font-family="system-ui, sans-serif">${data.label}</text>`;
    svg += `<text x="${48}" y="${h / 2 + 10}" fill="${isLight ? "#64748b" : "#94a3b8"}" font-size="10" font-family="system-ui, sans-serif">${data.tech || data.kind}</text>`;

    svg += `</g>`;
  }

  svg += `</svg>`;

  // Generate iframe snippet
  const iframeSnippet = `<iframe src="about:blank" width="${svgWidth}" height="${svgHeight}" style="border:1px solid ${isLight ? "#e2e8f0" : "#1e293b"};border-radius:8px;"></iframe>\n<!-- Replace src with actual SVG data URL or hosted endpoint -->`;

  return {
    svg,
    width: svgWidth,
    height: svgHeight,
    iframeSnippet,
  };
}
