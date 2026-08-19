/** SVG export from the canvas — clean, vector, board-ready. */

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";
import type { BoardExportMeta } from "./export-board";
import { renderLegendHtml, renderTitleBlockHtml } from "./export-board";

const NS = "http://www.w3.org/2000/svg";

function el(tag: string, attrs: Record<string, string> = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function textNode(content: string, attrs: Record<string, string> = {}) {
  const t = document.createElementNS(NS, "text");
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v);
  t.textContent = content;
  return t;
}

function svgForNodes(nodes: Node<CanvasNodeData>[], opts?: { width?: number; height?: number; padding?: number }) {
  const W = opts?.width ?? 1600;
  const H = opts?.height ?? 900;
  const P = opts?.padding ?? 48;
  const svg = el("svg", {
    xmlns: NS,
    width: String(W),
    height: String(H),
    viewBox: `0 0 ${W} ${H}`,
  });

  // Background
  svg.appendChild(el("rect", { x: "0", y: "0", width: String(W), height: String(H), fill: "#070b10" }));

  // Nodes
  for (const n of nodes) {
    const x = Math.max(P, Math.min(W - P, n.position.x));
    const y = Math.max(P, Math.min(H - P, n.position.y));
    const w = Number(n.width ?? 220);
    const h = Number(n.height ?? 88);
    const label = n.data.label ?? "";
    const kind = n.data.kind ?? "";

    svg.appendChild(
      el("rect", {
        x: String(x),
        y: String(y),
        width: String(w),
        height: String(h),
        rx: "12",
        fill: "#121821",
        stroke: "#334155",
        "stroke-width": "1.5",
      }),
    );
    svg.appendChild(
      textNode(label, {
        x: String(x + 16),
        y: String(y + 28),
        fill: "#f1f5f9",
        "font-size": "14",
        "font-family": "system-ui, sans-serif",
        "font-weight": "600",
      }),
    );
    if (kind) {
      svg.appendChild(
        textNode(kind.toUpperCase(), {
          x: String(x + 16),
          y: String(y + 44),
          fill: "#94a3b8",
          "font-size": "10",
          "font-family": "system-ui, sans-serif",
        }),
      );
    }
  }

  return svg;
}

export function renderSvg(nodes: Node<CanvasNodeData>[], edges: Edge[], opts: { title: string; width?: number; height?: number } = { title: "Arquitetura" }) {
  const W = opts.width ?? 1600;
  const H = opts.height ?? 900;
  const svg = svgForNodes(nodes, { width: W, height: H });

  // Title block
  const footer = el("g", { transform: `translate(24, ${H - 80})` });
  footer.appendChild(textNode(opts.title, { fill: "#f1f5f9", "font-size": "16", "font-weight": "600" }));
  footer.appendChild(textNode("Archia — System Design Editor", { x: "0", y: "24", fill: "#94a3b8", "font-size": "11" }));
  svg.appendChild(footer);

  return new XMLSerializer().serializeToString(svg);
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
