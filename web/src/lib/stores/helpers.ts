/**
 * P4 — helpers compartilhados do graph-store (fatiado em slices).
 *
 * Movidos VERBATIM de graph-store.ts (mesma lógica, sem mudança de
 * comportamento): HISTORY_LIMIT, nextId, scheduleClearNotice, denyNest,
 * takeSnapshot, withHistory, edgeTouchesHandle.
 */
import type { Edge, Node } from "@xyflow/react";
import { blockDomainOf, nestDeniedMessage } from "../blocks";
import { isBlockData } from "../types";
import type { CanvasNodeData, NodeKind } from "../types";
import type { GraphSnapshot, GraphState } from "./types";

export const HISTORY_LIMIT = 80;

let nodeSeq = 1;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${nodeSeq++}`;
}

export function scheduleClearNotice(set: (partial: Partial<GraphState>) => void) {
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    set({ uiNotice: null });
    noticeTimer = null;
  }, 3500);
}

export function denyNest(
  set: (partial: Partial<GraphState>) => void,
  cardLabel: string,
  cardKind: NodeKind,
  block: Node<CanvasNodeData>,
) {
  const domain = blockDomainOf(block);
  if (!domain) return;
  const blockLabel = isBlockData(block.data) ? block.data.label : "bloco";
  set({
    uiNotice: {
      type: "error",
      text: nestDeniedMessage(cardLabel, cardKind, blockLabel, domain),
    },
  });
  scheduleClearNotice(set);
}

export function takeSnapshot(
  state: Pick<GraphState, "name" | "context" | "nfr" | "nodes" | "edges" | "selectedNodeId">,
): GraphSnapshot {
  return {
    name: state.name,
    context: state.context,
    nfr: structuredClone(state.nfr),
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
    selectedNodeId: state.selectedNodeId,
  };
}

export function withHistory(
  get: () => GraphState,
  set: (partial: Partial<GraphState>) => void,
  mutate: () => void,
) {
  const current = takeSnapshot(get());
  const past = [...get().past, current].slice(-HISTORY_LIMIT);
  mutate();
  set({ past, future: [] });
}

export function edgeTouchesHandle(edge: Edge, nodeId: string, handleId: string): boolean {
  const srcMatch = edge.source === nodeId && (edge.sourceHandle ?? null) === handleId;
  const tgtMatch = edge.target === nodeId && (edge.targetHandle ?? null) === handleId;
  return srcMatch || tgtMatch;
}
