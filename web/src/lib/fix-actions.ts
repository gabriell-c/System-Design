import type { Node } from "@xyflow/react";
import type { CanvasNodeData, FixAction, ZoneKind } from "./types";
import { applyPatternBundle } from "./pattern-apply";

export type FixActionStore = {
  setSelectedNodeId: (id: string | null) => void;
  setHighlightNodeIds: (ids: string[]) => void;
  addZone: (
    zoneKind: ZoneKind,
    position: { x: number; y: number },
    opts?: { label?: string; boundedContext?: string },
  ) => void;
  addCatalogNode: (catalogId: string, position: { x: number; y: number }) => boolean;
  addPatternNodes: (nodes: Node<CanvasNodeData>[]) => void;
};

/** P1.2.1 — Apply fix action from analysis finding. */
export function applyFixAction(store: FixActionStore, action: FixAction): boolean {
  const { action_type, payload } = action;
  const pos = { x: 320 + Math.random() * 80, y: 200 + Math.random() * 80 };

  switch (action_type) {
    case "select_node":
    case "highlight_node": {
      const nodeId = String(payload.node_id ?? "");
      if (nodeId) {
        store.setSelectedNodeId(nodeId);
        store.setHighlightNodeIds([nodeId]);
        return true;
      }
      return false;
    }
    case "add_zone": {
      const zoneKind = (payload.zoneKind as ZoneKind) ?? "data_mesh";
      store.addZone(zoneKind, pos, {
        label: String(payload.label ?? "Data Mesh Zone"),
        boundedContext: String(payload.boundedContext ?? ""),
      });
      return true;
    }
    case "add_catalog_node": {
      const catalogId = String(payload.catalogId ?? "");
      if (!catalogId) return false;
      return store.addCatalogNode(catalogId, pos);
    }
    case "apply_pattern": {
      const ids = (payload.patternIds as string[]) ?? [];
      const nodes = applyPatternBundle(ids, pos);
      if (!nodes.length) return false;
      store.addPatternNodes(nodes);
      return true;
    }
    default:
      return false;
  }
}
