import type { Node } from "@xyflow/react";
import type { CanvasNodeData, FreeNodeData } from "./types";
import { isFreeData } from "./types";

/** Resolve layer order from data or node id timestamp (`free-<ts>-<seq>`). */
export function freeLayerOrder(data: FreeNodeData, nodeId: string): number {
  if (data.layerOrder != null) return data.layerOrder;
  const match = nodeId.match(/^free-(\d+)-/);
  return match ? Number(match[1]) : 0;
}

/** Sort free nodes for render order — lower layer first (back), higher last (front). */
export function sortFreeNodesByLayer(nodes: Node<CanvasNodeData>[]): Node<CanvasNodeData>[] {
  return [...nodes].sort((a, b) => {
    const ao = isFreeData(a.data) ? freeLayerOrder(a.data, a.id) : 0;
    const bo = isFreeData(b.data) ? freeLayerOrder(b.data, b.id) : 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function nextFreeLayerOrder(nodes: Node<CanvasNodeData>[]): number {
  let max = Date.now();
  for (const n of nodes) {
    if (!isFreeData(n.data)) continue;
    max = Math.max(max, freeLayerOrder(n.data, n.id));
  }
  return max + 1;
}

export type FreeLayerDirection = "forward" | "backward" | "front" | "back";

/** Free shapes that can visually contain other elements. */
export function isFreeContainerNode(node: Node<CanvasNodeData>): boolean {
  if (node.type !== "free" || !isFreeData(node.data)) return false;
  return node.data.kind === "free-rectangle" || node.data.kind === "free-oval";
}

export function freeNodeSize(node: Node<CanvasNodeData>): { width: number; height: number } {
  const width = Number(
    node.width ?? (node.style as { width?: number } | undefined)?.width ?? 160,
  );
  const height = Number(
    node.height ?? (node.style as { height?: number } | undefined)?.height ?? 80,
  );
  return {
    width: Number.isFinite(width) && width > 0 ? width : 160,
    height: Number.isFinite(height) && height > 0 ? height : 80,
  };
}
