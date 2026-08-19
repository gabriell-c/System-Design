import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";

import type { BoardExportMeta } from "./export-board";

export type ExportQualityOptions = {
  /** Hide UI chrome (minimap, controls, title block) */
  hideChrome?: boolean;
  /** Transparent background */
  transparentBg?: boolean;
  /** Padding around diagram */
  padding?: number;
};

/** P1.5.1 — Prepare canvas for clean export (no chrome). */
export function prepareCleanExport(nodes: Node<CanvasNodeData>[], opts: ExportQualityOptions = {}) {
  const padding = opts.padding ?? 24;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const w = (n.width as number) ?? 220;
    const h = (n.height as number) ?? 80;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }

  if (!Number.isFinite(minX)) {
    return { bounds: { x: 0, y: 0, width: 800, height: 600 }, nodes };
  }

  return {
    bounds: {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    },
    nodes,
    hideChrome: opts.hideChrome ?? true,
    transparentBg: opts.transparentBg ?? false,
  };
}

export function exportChromeClass(hide: boolean): string {
  return hide ? "archia-export-clean" : "";
}

export type { BoardExportMeta };
export { renderLegendHtml, renderTitleBlockHtml } from "./export-board";
