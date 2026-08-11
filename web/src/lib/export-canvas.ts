"use client";

import type { Edge, Node } from "@xyflow/react";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import {
  downloadDataUrl,
  toArchitecturePrintHtml,
} from "./export";
import type { AnalysisResult, CanvasNodeData, ProjectNfr } from "./types";

export async function captureCanvasPng(
  nodes: Node<CanvasNodeData>[],
  options?: { width?: number; height?: number; backgroundColor?: string; padding?: number },
): Promise<string> {
  if (nodes.length === 0) {
    throw new Error("Canvas vazio — adicione blocos ou cards antes de exportar a imagem.");
  }
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!viewport) {
    throw new Error("Canvas não encontrado na página.");
  }

  const width = options?.width ?? 1600;
  const height = options?.height ?? 900;
  const padding = options?.padding ?? 0.15;
  const backgroundColor = options?.backgroundColor ?? "#070b10";
  const bounds = getNodesBounds(nodes);
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 0.25, 1.75, padding);

  return toPng(viewport, {
    backgroundColor,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  });
}

export async function exportArchitecturePng(
  filename: string,
  nodes: Node<CanvasNodeData>[],
): Promise<void> {
  const dataUrl = await captureCanvasPng(nodes);
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
  },
): Promise<void> {
  let diagramDataUrl: string | null = null;
  if (options?.includeDiagram !== false && nodes.length > 0) {
    try {
      diagramDataUrl = await captureCanvasPng(nodes, { width: 1400, height: 800 });
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
