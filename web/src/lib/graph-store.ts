"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import {
  absolutePosition,
  blockDomainOf,
  canNestCardInBlock,
  createBlockNode,
  detachFromParent,
  findBlockAtPoint,
  isBlockNode,
  nestDeniedMessage,
  nestInsideBlock,
} from "./blocks";
import { findCatalog } from "./catalog";
import { checkRecommendations, type StackRecommendation } from "./stack-recommend";
import type {
  AnalysisResult,
  ArchNodeData,
  CanvasNodeData,
  GraphRecord,
  NodeKind,
  ProjectNfr,
  UserRole,
} from "./types";
import { isArchData, isBlockData } from "./types";
import { emptyNfr, normalizeNfr } from "./nfr";
import type { ProjectTemplate } from "./templates";

export type UiNotice = {
  type: "error" | "info" | "success";
  text: string;
};

export type GraphSnapshot = {
  name: string;
  context: string;
  nfr: ProjectNfr;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
};

const HISTORY_LIMIT = 80;

type GraphState = {
  name: string;
  context: string;
  nfr: ProjectNfr;
  graphId: string | null;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  analysis: AnalysisResult | null;
  analyzing: boolean;
  analyzeError: string | null;
  uiNotice: UiNotice | null;
  recommendations: StackRecommendation[];
  userRole: UserRole;
  dirty: boolean;
  lastSavedAt: string | null;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  setName: (name: string) => void;
  setContext: (context: string) => void;
  setNfr: (nfr: ProjectNfr | ((prev: ProjectNfr) => ProjectNfr)) => void;
  applyTemplate: (template: ProjectTemplate) => void;
  setUserRole: (role: UserRole) => void;
  setSelectedNodeId: (id: string | null) => void;
  clearUiNotice: () => void;
  pushUiNotice: (notice: UiNotice) => void;
  dismissRecommendations: () => void;
  onNodesChange: (changes: NodeChange<Node<CanvasNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  disconnectHandle: (nodeId: string, handleId: string) => number;
  disconnectEdge: (edgeId: string) => boolean;
  addCatalogNode: (
    catalogId: string,
    position: { x: number; y: number },
    parentId?: string | null,
  ) => boolean;
  addBlock: (domain: NodeKind, position: { x: number; y: number }, label?: string) => void;
  renameNode: (id: string, label: string) => void;
  attachNodeToBlock: (nodeId: string, blockId: string) => boolean;
  detachNode: (nodeId: string) => void;
  deleteSelected: () => void;
  resolveNestingAfterDrag: (nodeId: string) => void;
  reconcileOrphanCards: () => void;
  checkpointDrag: () => void;
  updateNodeData: (id: string, patch: Partial<ArchNodeData>) => void;
  updateNodeConfig: (id: string, config: ArchNodeData["config"]) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  setAnalyzing: (value: boolean, error?: string | null) => void;
  loadGraph: (graph: GraphRecord) => void;
  loadSnapshot: (
    name: string,
    nodes: Node<CanvasNodeData>[],
    edges: Edge[],
    analysis?: AnalysisResult | null,
    context?: string,
    nfr?: ProjectNfr | null,
  ) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
  markSaved: (id: string) => void;
};

let nodeSeq = 1;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${nodeSeq++}`;
}

function scheduleClearNotice(set: (partial: Partial<GraphState>) => void) {
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    set({ uiNotice: null });
    noticeTimer = null;
  }, 3500);
}

function denyNest(
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

function takeSnapshot(
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

function withHistory(
  get: () => GraphState,
  set: (partial: Partial<GraphState>) => void,
  mutate: () => void,
) {
  const current = takeSnapshot(get());
  const past = [...get().past, current].slice(-HISTORY_LIMIT);
  mutate();
  set({ past, future: [] });
}

function edgeTouchesHandle(edge: Edge, nodeId: string, handleId: string): boolean {
  const srcMatch = edge.source === nodeId && (edge.sourceHandle ?? null) === handleId;
  const tgtMatch = edge.target === nodeId && (edge.targetHandle ?? null) === handleId;
  return srcMatch || tgtMatch;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  name: "Nova arquitetura",
  context: "",
  nfr: emptyNfr(),
  graphId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  analysis: null,
  analyzing: false,
  analyzeError: null,
  uiNotice: null,
  recommendations: [],
  userRole: "senior",
  dirty: false,
  lastSavedAt: null,
  past: [],
  future: [],

  setName: (name) => {
    withHistory(get, set, () => set({ name, dirty: true }));
  },
  setContext: (context) => {
    set({ context, dirty: true });
  },
  setNfr: (nfrOrFn) => {
    const next = typeof nfrOrFn === "function" ? nfrOrFn(get().nfr) : nfrOrFn;
    set({ nfr: normalizeNfr(next), dirty: true });
  },
  applyTemplate: (template) => {
    withHistory(get, set, () => {
      const built = template.build();
      set({
        name: template.name,
        context: template.context,
        nfr: normalizeNfr(template.nfr),
        nodes: built.nodes,
        edges: built.edges,
        analysis: null,
        dirty: true,
        selectedNodeId: null,
        graphId: null,
        uiNotice: {
          type: "success",
          text: `Template “${template.label}” aplicado. Ajuste NFRs e rode a Análise.`,
        },
      });
      scheduleClearNotice(set);
    });
  },
  setUserRole: (userRole) => set({ userRole }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  clearUiNotice: () => set({ uiNotice: null }),
  pushUiNotice: (notice) => {
    set({ uiNotice: notice });
    scheduleClearNotice(set);
  },

  dismissRecommendations: () => {
    set({ recommendations: [] });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    const { past, future, name, context, nfr, nodes, edges, selectedNodeId } = get();
    if (past.length === 0) return false;
    const previous = past[past.length - 1];
    const current = takeSnapshot({ name, context, nfr, nodes, edges, selectedNodeId });
    set({
      name: previous.name,
      context: previous.context,
      nfr: previous.nfr ?? emptyNfr(),
      nodes: previous.nodes,
      edges: previous.edges,
      selectedNodeId: previous.selectedNodeId,
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, HISTORY_LIMIT),
      dirty: true,
      uiNotice: { type: "info", text: "Desfeito" },
    });
    scheduleClearNotice(set);
    return true;
  },

  redo: () => {
    const { past, future, name, context, nfr, nodes, edges, selectedNodeId } = get();
    if (future.length === 0) return false;
    const next = future[0];
    const current = takeSnapshot({ name, context, nfr, nodes, edges, selectedNodeId });
    set({
      name: next.name,
      context: next.context,
      nfr: next.nfr ?? emptyNfr(),
      nodes: next.nodes,
      edges: next.edges,
      selectedNodeId: next.selectedNodeId,
      past: [...past, current].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      dirty: true,
      uiNotice: { type: "info", text: "Refeito" },
    });
    scheduleClearNotice(set);
    return true;
  },

  onNodesChange: (changes) => {
    const structural = changes.some(
      (c) => c.type === "remove" || c.type === "add" || c.type === "replace",
    );
    const apply = () => {
      let next = applyNodeChanges(changes, get().nodes);
      // RF 12 guarda width/height no node; espelha no style p/ hit-test e layout estáveis
      next = next.map((n) => {
        if (!isBlockNode(n)) return n;
        const w = n.width ?? (n.style as { width?: number } | undefined)?.width;
        const h = n.height ?? (n.style as { height?: number } | undefined)?.height;
        if (w == null && h == null) return n;
        return {
          ...n,
          width: w ?? n.width,
          height: h ?? n.height,
          style: {
            ...n.style,
            ...(w != null ? { width: w } : {}),
            ...(h != null ? { height: h } : {}),
          },
        };
      });
      return next;
    };
    if (structural) {
      withHistory(get, set, () => {
        set({
          nodes: apply(),
          dirty: true,
        });
      });
      return;
    }
    set({
      nodes: apply(),
      dirty: true,
    });
  },

  onEdgesChange: (changes) => {
    const structural = changes.some((c) => c.type === "remove" || c.type === "add");
    if (structural) {
      withHistory(get, set, () => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
          dirty: true,
        });
      });
      return;
    }
    set({
      edges: applyEdgeChanges(changes, get().edges),
      dirty: true,
    });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    withHistory(get, set, () => {
      set({
        edges: addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          },
          get().edges,
        ),
        dirty: true,
      });
    });
  },

  disconnectHandle: (nodeId, handleId) => {
    const before = get().edges;
    const next = before.filter((e) => !edgeTouchesHandle(e, nodeId, handleId));
    const removed = before.length - next.length;
    if (removed === 0) {
      set({
        uiNotice: {
          type: "info",
          text: "Nenhuma associação neste ponto de ancoragem.",
        },
      });
      scheduleClearNotice(set);
      return 0;
    }
    withHistory(get, set, () => {
      set({
        edges: next,
        dirty: true,
        uiNotice: {
          type: "info",
          text:
            removed === 1
              ? "Associação removida (duplo clique no ponto)."
              : `${removed} associações removidas deste ponto.`,
        },
      });
    });
    scheduleClearNotice(set);
    return removed;
  },

  disconnectEdge: (edgeId) => {
    const exists = get().edges.some((e) => e.id === edgeId);
    if (!exists) return false;
    withHistory(get, set, () => {
      set({
        edges: get().edges.filter((e) => e.id !== edgeId),
        dirty: true,
        uiNotice: { type: "info", text: "Linha de associação removida." },
      });
    });
    scheduleClearNotice(set);
    return true;
  },

  addCatalogNode: (catalogId, position, parentId = null) => {
    const item = findCatalog(catalogId);
    if (!item) return false;
    const id = nextId("n");
    let node: Node<CanvasNodeData> = {
      id,
      type: "arch",
      position,
      data: {
        kind: item.kind,
        label: item.label,
        catalogId: item.id,
        tech: item.tech,
        config: { ...item.defaults },
        score: null,
      },
    };

    const nodes = get().nodes;
    let notice: UiNotice | null = null;

    const tryNest = (block: Node<CanvasNodeData>, asErrorOnly = false) => {
      const domain = blockDomainOf(block);
      if (domain && canNestCardInBlock(item.kind, domain)) {
        if (asErrorOnly) return false;
        node = nestInsideBlock(node, block, nodes);
        notice = {
          type: "success",
          text: `${item.label} dentro de “${isBlockData(block.data) ? block.data.label : "bloco"}”.`,
        };
        return true;
      }
      if (domain) {
        notice = {
          type: "error",
          text: nestDeniedMessage(
            item.label,
            item.kind,
            isBlockData(block.data) ? block.data.label : "bloco",
            domain,
          ),
        };
      }
      return false;
    };

    if (parentId) {
      const block = nodes.find((n) => n.id === parentId && isBlockNode(n));
      if (block) tryNest(block);
    } else {
      const atPoint = findBlockAtPoint(nodes, {
        x: position.x + 110,
        y: position.y + 40,
      });
      if (atPoint) {
        tryNest(atPoint);
      } else {
        const selected = get().selectedNodeId;
        const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;
        const preferred =
          selectedNode && isBlockNode(selectedNode) && blockDomainOf(selectedNode) === item.kind
            ? selectedNode
            : (nodes.find((n) => isBlockNode(n) && blockDomainOf(n) === item.kind) ?? null);
        if (preferred) tryNest(preferred);
      }
    }

    withHistory(get, set, () => {
      set({ nodes: [...get().nodes, node], dirty: true, selectedNodeId: id, uiNotice: notice });
    });
    if (notice) scheduleClearNotice(set);

    // Check for stack recommendations
    const existingTechs = get().nodes
      .filter((n) => !isBlockNode(n) && n.id !== id)
      .map((n) => (n.data as ArchNodeData).tech);
    const recs = checkRecommendations(catalogId, existingTechs);
    if (recs.length > 0) {
      set({ recommendations: recs });
    }

    return node.parentId != null || (notice as UiNotice | null)?.type !== "error";
  },

  addBlock: (domain, position, label) => {
    const id = nextId("block");
    const block = createBlockNode(id, domain, position, label);
    withHistory(get, set, () => {
      set({
        nodes: [...get().nodes, block],
        dirty: true,
        selectedNodeId: id,
      });
    });
  },

  renameNode: (id, label) => {
    const trimmed = label.trim() || "Sem nome";
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, label: trimmed } } : node,
        ),
        dirty: true,
      });
    });
  },

  attachNodeToBlock: (nodeId, blockId) => {
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === nodeId);
    const block = nodes.find((n) => n.id === blockId);
    if (!node || !block || isBlockNode(node) || !isBlockNode(block) || !isArchData(node.data)) {
      return false;
    }
    if (node.parentId === blockId) return true;

    const domain = blockDomainOf(block);
    if (!domain || !canNestCardInBlock(node.data.kind, domain)) {
      denyNest(set, node.data.label, node.data.kind, block);
      return false;
    }

    const detached = node.parentId ? detachFromParent(node, nodes) : node;
    const nested = nestInsideBlock(detached, block, nodes);
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((n) => (n.id === nodeId ? nested : n)),
        dirty: true,
        uiNotice: null,
      });
    });
    return true;
  },

  detachNode: (nodeId) => {
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.parentId) return;
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((n) => (n.id === nodeId ? detachFromParent(n, get().nodes) : n)),
        dirty: true,
      });
    });
  },

  deleteSelected: () => {
    const selected = get().selectedNodeId;
    if (!selected) return;
    const nodes = get().nodes;
    const target = nodes.find((n) => n.id === selected);
    if (!target) return;

    withHistory(get, set, () => {
      if (isBlockNode(target)) {
        const next = get()
          .nodes.filter((n) => n.id !== selected)
          .map((n) => (n.parentId === selected ? detachFromParent(n, get().nodes) : n));
        set({
          nodes: next,
          edges: get().edges.filter((e) => e.source !== selected && e.target !== selected),
          selectedNodeId: null,
          dirty: true,
        });
        return;
      }

      set({
        nodes: get().nodes.filter((n) => n.id !== selected),
        edges: get().edges.filter((e) => e.source !== selected && e.target !== selected),
        selectedNodeId: null,
        dirty: true,
      });
    });
  },

  checkpointDrag: () => {
    const current = takeSnapshot(get());
    set({ past: [...get().past, current].slice(-HISTORY_LIMIT), future: [] });
  },

  resolveNestingAfterDrag: (nodeId) => {
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Ao soltar um bloco, “adota” cards órfãos que estão visualmente dentro dele.
    if (isBlockNode(node)) {
      get().reconcileOrphanCards();
      return;
    }
    if (!isArchData(node.data)) return;

    const absX = node.position.x + (node.parentId ? absoluteParentOffset(node.parentId, nodes).x : 0);
    const absY = node.position.y + (node.parentId ? absoluteParentOffset(node.parentId, nodes).y : 0);
    const center = {
      x: absX + 110,
      y: absY + 40,
    };
    const block = findBlockAtPoint(nodes, center, nodeId);

    if (!block) {
      if (node.parentId) {
        withHistory(get, set, () => {
          set({
            nodes: get().nodes.map((n) => (n.id === nodeId ? detachFromParent(n, get().nodes) : n)),
            dirty: true,
          });
        });
      }
      return;
    }

    if (node.parentId === block.id) return;

    const domain = blockDomainOf(block);
    if (!domain || !canNestCardInBlock(node.data.kind, domain)) {
      if (node.parentId) {
        withHistory(get, set, () => {
          set({
            nodes: get().nodes.map((n) => (n.id === nodeId ? detachFromParent(n, get().nodes) : n)),
            dirty: true,
          });
        });
      }
      denyNest(set, node.data.label, node.data.kind, block);
      return;
    }

    const detached = node.parentId ? detachFromParent(node, nodes) : node;
    const nested = nestInsideBlock(detached, block, nodes);
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((n) => (n.id === nodeId ? nested : n)),
        dirty: true,
        uiNotice: {
          type: "success",
          text: `${node.data.label} anexado ao bloco.`,
        },
      });
    });
    scheduleClearNotice(set);
  },

  reconcileOrphanCards: () => {
    const nodes = get().nodes;
    let next = nodes;
    let changed = false;
    for (const card of nodes) {
      if (isBlockNode(card) || !isArchData(card.data) || card.parentId) continue;
      const abs = absolutePosition(card, next);
      const center = { x: abs.x + 110, y: abs.y + 40 };
      const block = findBlockAtPoint(next, center, card.id);
      if (!block) continue;
      const domain = blockDomainOf(block);
      if (!domain || !canNestCardInBlock(card.data.kind, domain)) continue;
      const nested = nestInsideBlock(card, block, next);
      next = next.map((n) => (n.id === card.id ? nested : n));
      changed = true;
    }
    if (!changed) return;
    withHistory(get, set, () => {
      set({
        nodes: next,
        dirty: true,
        uiNotice: {
          type: "info",
          text: "Cards dentro do bloco foram associados (agora andam junto).",
        },
      });
    });
    scheduleClearNotice(set);
  },

  updateNodeData: (id, patch) => {
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((node) => {
          if (node.id !== id || !isArchData(node.data)) return node;
          return { ...node, data: { ...node.data, ...patch } };
        }),
        dirty: true,
      });
    });
  },

  updateNodeConfig: (id, config) => {
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((node) => {
          if (node.id !== id || !isArchData(node.data)) return node;
          return { ...node, data: { ...node.data, config } };
        }),
        dirty: true,
      });
    });
  },

  setAnalysis: (analysis) => {
    const nodes = get().nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        score: analysis?.node_scores?.[node.id] ?? null,
        summary: analysis?.findings.find((f) => f.node_id === node.id)?.title,
      },
    }));
    set({ nodes, analysis, analyzeError: null });
  },

  setAnalyzing: (analyzing, error = null) => set({ analyzing, analyzeError: error }),

  loadGraph: (graph) => {
    set({
      graphId: graph.id,
      name: graph.name,
      context: graph.context ?? "",
      nfr: normalizeNfr(graph.nfr),
      nodes: (graph.nodes ?? []) as Node<CanvasNodeData>[],
      edges: (graph.edges ?? []) as Edge[],
      analysis: graph.analysis,
      dirty: false,
      lastSavedAt: graph.updated_at,
      selectedNodeId: null,
      uiNotice: null,
      past: [],
      future: [],
    });
  },

  loadSnapshot: (name, nodes, edges, analysis = null, context = "", nfr = null) => {
    withHistory(get, set, () => {
      set({
        name,
        context,
        nfr: normalizeNfr(nfr),
        nodes,
        edges,
        analysis,
        dirty: true,
        selectedNodeId: null,
        uiNotice: null,
      });
    });
  },

  reset: () => {
    withHistory(get, set, () => {
      set({
        name: "Nova arquitetura",
        context: "",
        nfr: emptyNfr(),
        graphId: null,
        nodes: [],
        edges: [],
        selectedNodeId: null,
        analysis: null,
        analyzing: false,
        analyzeError: null,
        uiNotice: null,
        dirty: false,
        lastSavedAt: null,
      });
    });
  },

  markSaved: (id) =>
    set({
      graphId: id,
      dirty: false,
      lastSavedAt: new Date().toISOString(),
    }),
}));

function absoluteParentOffset(parentId: string, nodes: Node<CanvasNodeData>[]) {
  let x = 0;
  let y = 0;
  let current: string | undefined = parentId;
  while (current) {
    const parent = nodes.find((n) => n.id === current);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent.parentId;
  }
  return { x, y };
}

export function selectedIsBlock(nodes: Node<CanvasNodeData>[], id: string | null) {
  if (!id) return false;
  const node = nodes.find((n) => n.id === id);
  return !!node && isBlockNode(node);
}
