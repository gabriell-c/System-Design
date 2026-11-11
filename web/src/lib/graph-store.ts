"use client";

/**
 * P4 — o god-store foi fatiado em `./stores/*-slice.ts`.
 *
 * Este arquivo continua sendo o único ponto de composição: as 287+
 * call-sites de `useGraphStore(...)` e `useGraphStore.getState()` não mudam.
 * Mesmas chaves de estado, mesmas assinaturas de ação — a API pública é
 * byte-compatível com a versão monolítica anterior.
 */
import { create } from "zustand";
import type { Node } from "@xyflow/react";
import { blockDomainOf, isBlockNode } from "./blocks";
import type { CanvasNodeData } from "./types";
import type { GraphState } from "./stores/types";
import { analysisSlice } from "./stores/analysis-slice";
import { documentSlice } from "./stores/document-slice";
import { filterSlice } from "./stores/filter-slice";
import { saveSlice } from "./stores/save-slice";
import { uiSlice } from "./stores/ui-slice";
import { undoSlice } from "./stores/undo-slice";

export type { GraphState, GraphSnapshot, UiNotice } from "./stores/types";

export const useGraphStore = create<GraphState>((set, get) => ({
  ...documentSlice(set, get),
  ...undoSlice(set, get),
  ...analysisSlice(set, get),
  ...uiSlice(set),
  ...saveSlice(set),
  ...filterSlice(set, get),
}));

export function selectedIsBlock(nodes: Node<CanvasNodeData>[], id: string | null) {
  if (!id) return false;
  const node = nodes.find((n) => n.id === id);
  return node ? isBlockNode(node) && blockDomainOf(node) != null : false;
}
