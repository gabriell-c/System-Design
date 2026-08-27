/**
 * Performance helpers for free-canvas node ordering (T12).
 * Re-exports layer sort from free-layer and adds a stable memo key.
 */
export {
  freeLayerOrder,
  sortFreeNodesByLayer,
  nextFreeLayerOrder,
  isFreeContainerNode,
  freeNodeSize,
  type FreeLayerDirection,
} from "./free-layer";

import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";
import { freeLayerOrder } from "./free-layer";
import { isFreeData } from "./types";

/** Cheap fingerprint for memo deps — avoids sorting when layer order unchanged. */
export function freeLayerFingerprint(nodes: Node<CanvasNodeData>[]): string {
  let h = 2166136261;
  for (const n of nodes) {
    const id = n.id;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const order = isFreeData(n.data) ? freeLayerOrder(n.data, n.id) : 0;
    h ^= order;
    h = Math.imul(h, 16777619);
    if (n.parentId) {
      for (let i = 0; i < n.parentId.length; i++) {
        h ^= n.parentId.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
    }
  }
  return (h >>> 0).toString(36);
}
