/**
 * P4 — undo/redo slice do graph-store (movido VERBATIM de graph-store.ts).
 */
import { emptyNfr } from "../nfr";
import { HISTORY_LIMIT, scheduleClearNotice, takeSnapshot } from "./helpers";
import type { GraphState } from "./types";
import type { StoreApi } from "zustand";

type SetFn = StoreApi<GraphState>["setState"];
type GetFn = () => GraphState;

export function undoSlice(
  set: SetFn,
  get: GetFn,
): Pick<GraphState, "past" | "future" | "undo" | "redo" | "canUndo" | "canRedo"> {
  return {
  past: [],
  future: [],

    canUndo: () => get().past.length > 0,

  canRedo: () => get().future.length > 0,

  undo: () => {
    const {
      past,
      future,
      name,
      context,
      nfr,
      nodes,
      edges,
      selectedNodeId,
      excalidrawElements,
      selectedNodeIds,
      diagramKind,
    } = get();
    if (past.length === 0) return false;
    const previous = past[past.length - 1];
    const current = takeSnapshot({
      name,
      context,
      nfr,
      nodes,
      edges,
      selectedNodeId,
      excalidrawElements,
      selectedNodeIds,
      diagramKind,
    });
    set({
      name: previous.name,
      context: previous.context,
      nfr: previous.nfr ?? emptyNfr(),
      nodes: previous.nodes,
      edges: previous.edges,
      selectedNodeId: previous.selectedNodeId,
      selectedNodeIds:
        previous.selectedNodeIds ?? (previous.selectedNodeId ? [previous.selectedNodeId] : []),
      excalidrawElements: previous.excalidrawElements ?? [],
      diagramKind: previous.diagramKind ?? null,
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, HISTORY_LIMIT),
      dirty: true,
      uiNotice: { type: "info", text: "Desfeito" },
    });
    scheduleClearNotice(set);
    return true;
  },

  redo: () => {
    const {
      past,
      future,
      name,
      context,
      nfr,
      nodes,
      edges,
      selectedNodeId,
      excalidrawElements,
      selectedNodeIds,
      diagramKind,
    } = get();
    if (future.length === 0) return false;
    const next = future[0];
    const current = takeSnapshot({
      name,
      context,
      nfr,
      nodes,
      edges,
      selectedNodeId,
      excalidrawElements,
      selectedNodeIds,
      diagramKind,
    });
    set({
      name: next.name,
      context: next.context,
      nfr: next.nfr ?? emptyNfr(),
      nodes: next.nodes,
      edges: next.edges,
      selectedNodeId: next.selectedNodeId,
      selectedNodeIds: next.selectedNodeIds ?? (next.selectedNodeId ? [next.selectedNodeId] : []),
      excalidrawElements: next.excalidrawElements ?? [],
      diagramKind: next.diagramKind ?? null,
      past: [...past, current].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      dirty: true,
      uiNotice: { type: "info", text: "Refeito" },
    });
    scheduleClearNotice(set);
    return true;
  },
  };
}
