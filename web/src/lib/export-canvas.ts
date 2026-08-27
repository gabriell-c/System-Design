"use client";

import type { Edge, Node } from "@xyflow/react";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import {
  downloadDataUrl,
  toArchitecturePrintHtml,
} from "./export";
import type { AnalysisResult, CanvasNodeData, ProjectNfr } from "./types";
import {
  BOARD_LEGEND_HEIGHT,
  BOARD_LEGEND_WIDTH,
  BOARD_PADDING,
  BOARD_TITLE_BLOCK_HEIGHT,
  type BoardExportMeta,
  renderLegendHtml,
  renderTitleBlockHtml,
} from "./export-board";

export type CaptureCanvasOptions = {
  width?: number;
  height?: number;
  backgroundColor?: string;
  padding?: number;
  pixelRatio?: number;
  /** Inclui title block + legenda no artefato exportado (board-ready). */
  boardReady?: boolean;
  meta?: BoardExportMeta;
};

export async function captureCanvasPng(
  nodes: Node<CanvasNodeData>[],
  options?: CaptureCanvasOptions,
): Promise<string> {
  if (nodes.length === 0) {
    throw new Error("Canvas vazio — adicione blocos ou cards antes de exportar a imagem.");
  }
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!viewport) {
    throw new Error("Canvas não encontrado na página.");
  }

  const diagramWidth = options?.width ?? 1600;
  const diagramHeight = options?.height ?? 900;
  const padding = options?.padding ?? 0.15;
  const backgroundColor = options?.backgroundColor ?? "#070b10";
  const boardReady = options?.boardReady ?? false;
  const meta: BoardExportMeta = options?.meta ?? { title: "Arquitetura" };

  const bounds = getNodesBounds(nodes);
  const { x, y, zoom } = getViewportForBounds(bounds, diagramWidth, diagramHeight, 0.25, 1.75, padding);

  const footerHeight = boardReady ? BOARD_TITLE_BLOCK_HEIGHT + BOARD_PADDING : 0;
  const legendColumn = boardReady ? BOARD_LEGEND_WIDTH + BOARD_PADDING : 0;
  const totalWidth = diagramWidth + legendColumn + (boardReady ? BOARD_PADDING * 2 : 0);
  const totalHeight = diagramHeight + footerHeight + (boardReady ? BOARD_PADDING * 2 : 0);

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${totalWidth}px`;
  wrapper.style.height = `${totalHeight}px`;
  wrapper.style.background = backgroundColor;

  const vpClone = viewport.cloneNode(true) as HTMLElement;
  vpClone.style.position = "absolute";
  vpClone.style.top = `${boardReady ? BOARD_PADDING : 0}px`;
  vpClone.style.left = `${boardReady ? BOARD_PADDING : 0}px`;
  vpClone.style.width = `${diagramWidth}px`;
  vpClone.style.height = `${diagramHeight}px`;
  vpClone.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  vpClone.style.overflow = "hidden";
  wrapper.appendChild(vpClone);

  if (boardReady) {
    const footer = document.createElement("div");
    footer.style.position = "absolute";
    footer.style.left = `${BOARD_PADDING}px`;
    footer.style.right = `${BOARD_LEGEND_WIDTH + BOARD_PADDING * 2}px`;
    footer.style.bottom = `${BOARD_PADDING}px`;
    footer.style.height = `${BOARD_TITLE_BLOCK_HEIGHT}px`;
    footer.style.padding = "12px 16px";
    footer.style.background = "rgba(13,18,25,0.98)";
    footer.style.border = "1px solid rgba(255,255,255,0.1)";
    footer.style.borderRadius = "8px";
    footer.innerHTML = renderTitleBlockHtml(meta);
    wrapper.appendChild(footer);

    const legend = document.createElement("div");
    legend.style.position = "absolute";
    legend.style.right = `${BOARD_PADDING}px`;
    legend.style.bottom = `${BOARD_PADDING}px`;
    legend.style.width = `${BOARD_LEGEND_WIDTH}px`;
    legend.style.minHeight = `${BOARD_LEGEND_HEIGHT}px`;
    legend.style.padding = "12px";
    legend.style.background = "rgba(13,18,25,0.98)";
    legend.style.border = "1px solid rgba(255,255,255,0.1)";
    legend.style.borderRadius = "8px";
    legend.innerHTML = renderLegendHtml();
    wrapper.appendChild(legend);
  }

  document.body.appendChild(wrapper);
  try {
    const pixelRatio = options?.pixelRatio ?? 2;
    return await toPng(wrapper, {
      backgroundColor,
      width: totalWidth,
      height: totalHeight,
      pixelRatio,
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function exportArchitecturePng(
  filename: string,
  nodes: Node<CanvasNodeData>[],
  options?: {
    boardReady?: boolean;
    meta?: BoardExportMeta;
    width?: number;
    height?: number;
    padding?: number;
    pixelRatio?: number;
  },
): Promise<void> {
  const dataUrl = await captureCanvasPng(nodes, {
    boardReady: options?.boardReady ?? true,
    meta: options?.meta,
    width: options?.width,
    height: options?.height,
    padding: options?.padding,
    pixelRatio: options?.pixelRatio,
  });
  downloadDataUrl(filename, dataUrl);
}

export async function exportArchitecturePdf(
  name: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  options?: {
    context?: string;
    nfr?: ProjectNfr | null;
    analysis?: AnalysisResult | null;
    includeDiagram?: boolean;
    meta?: BoardExportMeta;
  },
): Promise<void> {
  let diagramDataUrl: string | null = null;
  if (options?.includeDiagram !== false && nodes.length > 0) {
    try {
      diagramDataUrl = await captureCanvasPng(nodes, {
        width: 1400,
        height: 780,
        boardReady: true,
        meta: options?.meta ?? { title: name, nfr: options?.nfr },
      });
    } catch {
      diagramDataUrl = null;
    }
  }
  const html = toArchitecturePrintHtml(name, nodes, edges, {
    context: options?.context,
    nfr: options?.nfr,
    analysis: options?.analysis,
    diagramDataUrl,
  });
  const win = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
  if (!win) {
    throw new Error("Pop-up bloqueado — permita janelas para exportar PDF.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
