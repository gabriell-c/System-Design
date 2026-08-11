import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";
import { isBlockNode } from "./blocks";

export const SNAP_THRESHOLD = 8;

export type GuideLine = {
  id: string;
  type: "horizontal" | "vertical";
  position: number;
  min: number;
  max: number;
  color: string;
};

type SnapResult = {
  x: number;
  y: number;
  guidelines: GuideLine[];
};

function nodeBounds(node: Node<CanvasNodeData>, allNodes: Node<CanvasNodeData>[]) {
  const w = Number(node.width ?? (node.style as Record<string, unknown>)?.width ?? (isBlockNode(node) ? 420 : 220));
  const h = Number(node.height ?? (node.style as Record<string, unknown>)?.height ?? (isBlockNode(node) ? 280 : 78));
  return {
    left: node.position.x,
    right: node.position.x + w,
    centerX: node.position.x + w / 2,
    top: node.position.y,
    bottom: node.position.y + h,
    centerY: node.position.y + h / 2,
    width: w,
    height: h,
  };
}

export function computeSnap(
  draggedId: string,
  position: { x: number; y: number },
  allNodes: Node<CanvasNodeData>[],
): SnapResult {
  const dragged = allNodes.find((n) => n.id === draggedId);
  if (!dragged) return { x: position.x, y: position.y, guidelines: [] };

  const dw = Number(dragged.width ?? (dragged.style as Record<string, unknown>)?.width ?? (isBlockNode(dragged) ? 420 : 220));
  const dh = Number(dragged.height ?? (dragged.style as Record<string, unknown>)?.height ?? (isBlockNode(dragged) ? 280 : 78));

  const dLeft = position.x;
  const dRight = position.x + dw;
  const dCenterX = position.x + dw / 2;
  const dTop = position.y;
  const dBottom = position.y + dh;
  const dCenterY = position.y + dh / 2;

  let bestDx = SNAP_THRESHOLD + 1;
  let bestDy = SNAP_THRESHOLD + 1;
  let snapX = position.x;
  let snapY = position.y;
  const guidelines: GuideLine[] = [];
  let guideId = 0;

  for (const other of allNodes) {
    if (other.id === draggedId) continue;
    // Skip cards nested in the dragged block
    if (other.parentId === draggedId) continue;

    const o = nodeBounds(other, allNodes);

    // Vertical guidelines (X alignment)
    const xChecks: [number, number, string][] = [
      [dLeft, o.left, "left-left"],
      [dLeft, o.right, "left-right"],
      [dRight, o.left, "right-left"],
      [dRight, o.right, "right-right"],
      [dCenterX, o.centerX, "center-center"],
    ];
    for (const [dVal, oVal, label] of xChecks) {
      const diff = Math.abs(dVal - oVal);
      if (diff < bestDx && diff <= SNAP_THRESHOLD) {
        bestDx = diff;
        snapX = position.x + (oVal - dVal);
        // Build guideline
        const minY = Math.min(dTop, o.top) - 20;
        const maxY = Math.max(dBottom, o.bottom) + 20;
        guidelines.push({
          id: `gx-${guideId++}`,
          type: "vertical",
          position: oVal,
          min: minY,
          max: maxY,
          color: "#22d3ee",
        });
      }
    }

    // Horizontal guidelines (Y alignment)
    const yChecks: [number, number, string][] = [
      [dTop, o.top, "top-top"],
      [dTop, o.bottom, "top-bottom"],
      [dBottom, o.top, "bottom-top"],
      [dBottom, o.bottom, "bottom-bottom"],
      [dCenterY, o.centerY, "center-center"],
    ];
    for (const [dVal, oVal, label] of yChecks) {
      const diff = Math.abs(dVal - oVal);
      if (diff < bestDy && diff <= SNAP_THRESHOLD) {
        bestDy = diff;
        snapY = position.y + (oVal - dVal);
        const minX = Math.min(dLeft, o.left) - 20;
        const maxX = Math.max(dRight, o.right) + 20;
        guidelines.push({
          id: `gy-${guideId++}`,
          type: "horizontal",
          position: oVal,
          min: minX,
          max: maxX,
          color: "#22d3ee",
        });
      }
    }
  }

  return { x: snapX, y: snapY, guidelines };
}
