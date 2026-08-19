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
  options?: { width?: number; height?: number; backgroundColor?: string; padding?: number; titleBlock?: boolean },
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

  // Build optional title block HTML below the diagram
  const titleBlockHtml = options?.titleBlock
    ? `<div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:rgba(7,11,16,0.95);border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:11px;color:#94a3b8;">
         <span>Diagrama · Arquitetura de Software</span>
         <span style="color:#64748b">Exportado do Archia</span>
       </div>`
    : "";

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height + (options?.titleBlock ? 60 : 0)}px`;
  wrapper.style.background = backgroundColor;

  const vpClone = viewport.cloneNode(true) as HTMLElement;
  vpClone.style.position = "absolute";
  vpClone.style.top = "0";
  vpClone.style.left = "0";
  vpClone.style.width = `${width}px`;
  vpClone.style.height = `${height}px`;
  vpClone.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  vpClone.style.overflow = "hidden";
  wrapper.appendChild(vpClone);

  if (titleBlockHtml) {
    const tb = document.createElement("div");
    tb.innerHTML = titleBlockHtml;
    tb.style.position = "absolute";
    tb.style.bottom = "0";
    tb.style.left = "0";
    tb.style.right = "0";
    wrapper.appendChild(tb);
  }

  document.body.appendChild(wrapper);
  try {
    const dataUrl = await toPng(wrapper, { backgroundColor, width, height: height + (options?.titleBlock ? 60 : 0) });
    return dataUrl;
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function exportArchitecturePng(
  filename: string,
  nodes: Node<CanvasNodeData>[],
  options?: { titleBlock?: boolean },
): Promise<void> {
  const dataUrl = await captureCanvasPng(nodes, { ...options, titleBlock: options?.titleBlock ?? true });
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
