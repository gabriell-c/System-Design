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
  canNestIntoContainer,
  createBlockNode,
  detachFromParent,
  findContainerAtPoint,
  isBlockNode,
  isContainerNode,
  nestDeniedMessage,
  nestInsideBlock,
} from "./blocks";
import { buildArchEdge, nextFlowNumber, normalizeEdgeData, styleEdgeFromData } from "./edges";
import { findCatalog } from "./catalog";
import { checkRecommendations, type StackRecommendation } from "./stack-recommend";
import type {
  AnalysisResult,
  ArchEdgeData,
  ArchNodeData,
  CanvasNodeData,
  CloudProvider,
  GraphRecord,
  NodeKind,
  ProjectNfr,
  UserRole,
  ZoneKind,
} from "./types";
import { isArchData, isBlockData, isZoneData } from "./types";
import { emptyNfr, normalizeNfr } from "./nfr";
import type { ProjectTemplate } from "./templates";
import { createZoneNode, ensureZoneFitsChild, isZoneNode, ZONE_DEFAULT_SIZE } from "./zones";
import type { ArchitectureView } from "./architecture-view";
import { VIEW_C4_LEVEL } from "./architecture-view";
import type { C4Level } from "./types";
import { EMPTY_CANVAS_FILTER, type CanvasFilter } from "./canvas-filter";
import { applyFixAction } from "./fix-actions";
import { saveSavedView } from "./saved-views";
import type { SavedView } from "./types";

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
  selectedEdgeId: string | null;
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
  architectureView: ArchitectureView;
  canvasFilter: CanvasFilter;
  savedViewsTick: number;
  focusedZoneId: string | null;
  ownerTeam: string;
  canvasComments: import("./types").CanvasComment[];
  highlightNodeIds: string[];
  diffHighlights: import("./diff-highlight").DiffHighlight[];
  _pendingNodesChanges: NodeChange<Node<CanvasNodeData>>[] | null;
  _pendingTimeout: ReturnType<typeof setTimeout> | null;
  setName: (name: string) => void;
  setContext: (context: string) => void;
  setNfr: (nfr: ProjectNfr | ((prev: ProjectNfr) => ProjectNfr)) => void;
  setArchitectureView: (view: ArchitectureView) => void;
  setCanvasFilter: (filter: CanvasFilter) => void;
  saveView: (name: string, tags?: string[]) => SavedView;
  loadView: (view: SavedView) => void;
  setFocusedZoneId: (id: string | null) => void;
  /** P3.1.1 — drill-down para vista 4+1 */
  drillDownToView: (view: ArchitectureView) => void;
  setOwnerTeam: (team: string) => void;
  setCanvasComments: (comments: import("./types").CanvasComment[]) => void;
  setHighlightNodeIds: (ids: string[]) => void;
  addPatternNodes: (nodes: Node<CanvasNodeData>[]) => void;
  applyFixFromFinding: (action: import("./types").FixAction) => boolean;
  applyTemplate: (template: ProjectTemplate) => void;
  setUserRole: (role: UserRole) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
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
  addZone: (
    zoneKind: ZoneKind,
    position: { x: number; y: number },
    opts?: { label?: string; provider?: CloudProvider; boundedContext?: string },
  ) => void;
  updateEdgeData: (edgeId: string, patch: Partial<ArchEdgeData>) => void;
  renameNode: (id: string, label: string) => void;
  attachNodeToBlock: (nodeId: string, blockId: string) => boolean;
  detachNode: (nodeId: string) => void;
  deleteSelected: () => void;
  resolveNestingAfterDrag: (nodeId: string) => void;
  reconcileOrphanCards: () => void;
  checkpointDrag: () => void;
  updateNodeData: (id: string, patch: Partial<ArchNodeData> | Partial<import("./types").ZoneNodeData>) => void;
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
  selectedEdgeId: null,
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
  architectureView: "all",
  canvasFilter: EMPTY_CANVAS_FILTER,
  savedViewsTick: 0,
  focusedZoneId: null,
  ownerTeam: "",
  canvasComments: [],
  highlightNodeIds: [],
  diffHighlights: [],
  _pendingNodesChanges: null,
  _pendingTimeout: null,

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
  setArchitectureView: (architectureView) => set({ architectureView }),
  setCanvasFilter: (canvasFilter) => set({ canvasFilter }),
  saveView: (name, tags) => {
    const { graphId, canvasFilter, savedViewsTick } = get();
    const view = saveSavedView(graphId, { name, tags, filter: canvasFilter });
    set({ savedViewsTick: savedViewsTick + 1 });
    get().pushUiNotice({ type: "success", text: `View "${view.name}" salva.` });
    return view;
  },
  loadView: (view) => {
    set({ canvasFilter: { ...view.filter } });
    get().pushUiNotice({ type: "info", text: `View "${view.name}" aplicada.` });
  },
  setFocusedZoneId: (focusedZoneId) => set({ focusedZoneId }),
  /** P3.1.1 — drill-down para vista 4+1 */
  drillDownToView: (view: ArchitectureView) => {
    set({
      architectureView: view,
      focusedZoneId: null,
      canvasFilter: { ...EMPTY_CANVAS_FILTER, c4Level: (VIEW_C4_LEVEL[view] ?? "all") as C4Level | "all" },
    });
  },
  setOwnerTeam: (ownerTeam) => set({ ownerTeam, dirty: true }),
  setCanvasComments: (canvasComments) => set({ canvasComments }),
  setHighlightNodeIds: (highlightNodeIds) => set({ highlightNodeIds }),
  setDiffHighlights: (diffHighlights) => set({ diffHighlights }),
  addPatternNodes: (patternNodes) => {
    withHistory(get, set, () => {
      set({
        nodes: [...get().nodes, ...patternNodes],
        dirty: true,
        selectedNodeId: patternNodes[0]?.id ?? get().selectedNodeId,
      });
    });
  },
  applyFixFromFinding: (action) => applyFixAction(get(), action),
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
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId, selectedEdgeId: null }),
  setSelectedEdgeId: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null }),
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
        if (!isContainerNode(n)) return n;
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
    // Debounce non-structural changes (position, dimensions)
    const pending = [...(get()._pendingNodesChanges ?? []), ...changes];
    if (get()._pendingTimeout) clearTimeout(get()._pendingTimeout);
    const timer = setTimeout(() => {
      set({ _pendingNodesChanges: null, _pendingTimeout: null });
      const applied = applyNodeChanges(pending, get().nodes);
      set({ nodes: applied, dirty: true });
    }, 150);
    set({ _pendingNodesChanges: pending, _pendingTimeout: timer });
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
      const edges = get().edges;
      const edge = buildArchEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        },
        nextFlowNumber(edges),
      );
      set({
        edges: addEdge(edge, edges),
        dirty: true,
      });
    });
  },

  updateEdgeData: (edgeId, patch) => {
    withHistory(get, set, () => {
      set({
        edges: get().edges.map((e) => {
          if (e.id !== edgeId) return e;
          const data = normalizeEdgeData({ ...normalizeEdgeData(e.data), ...patch });
          return { ...e, data, ...styleEdgeFromData(data) };
        }),
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

    const tryNest = (container: Node<CanvasNodeData>) => {
      if (!canNestIntoContainer(node, container, nodes)) {
        if (isBlockNode(container) && isArchData(node.data)) {
          const domain = blockDomainOf(container);
          if (domain) {
            notice = {
              type: "error",
              text: nestDeniedMessage(
                item.label,
                item.kind,
                isBlockData(container.data) ? container.data.label : "bloco",
                domain,
              ),
            };
          }
        }
        return false;
      }
      node = nestInsideBlock(node, container, nodes);
      const label =
        isZoneData(container.data) || isBlockData(container.data) ? container.data.label : "contêiner";
      notice = { type: "success", text: `${item.label} dentro de “${label}”.` };
      return true;
    };

    if (parentId) {
      const container = nodes.find((n) => n.id === parentId && isContainerNode(n));
      if (container) tryNest(container);
    } else {
      const atPoint = findContainerAtPoint(nodes, {
        x: position.x + 110,
        y: position.y + 40,
      });
      if (atPoint) {
        tryNest(atPoint);
      } else {
        const selected = get().selectedNodeId;
        const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;
        if (selectedNode && isZoneNode(selectedNode)) {
          tryNest(selectedNode);
        } else {
          const preferred =
            selectedNode && isBlockNode(selectedNode) && blockDomainOf(selectedNode) === item.kind
              ? selectedNode
              : (nodes.find((n) => isBlockNode(n) && blockDomainOf(n) === item.kind) ?? null);
          if (preferred) tryNest(preferred);
        }
      }
    }

    withHistory(get, set, () => {
      set({ nodes: [...get().nodes, node], dirty: true, selectedNodeId: id, uiNotice: notice });
    });
    if (notice) scheduleClearNotice(set);

    const existingTechs = get().nodes
      .filter((n) => !isContainerNode(n) && n.id !== id)
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

  addZone: (zoneKind, position, opts) => {
    const id = nextId("zone");
    let zone = createZoneNode(id, zoneKind, position, opts);
    const nodes = get().nodes;
    const atPoint = findContainerAtPoint(nodes, {
      x: position.x + 40,
      y: position.y + 40,
    });
    let notice: UiNotice | null = null;
    if (atPoint && canNestIntoContainer(zone, atPoint, nodes)) {
      zone = nestInsideBlock(zone, atPoint, nodes) as typeof zone;
      const parentLabel =
        isZoneData(atPoint.data) || isBlockData(atPoint.data) ? atPoint.data.label : "zona";
      notice = { type: "success", text: `Zona aninhada em “${parentLabel}”.` };
    }
    withHistory(get, set, () => {
      let next = [...get().nodes, zone];
      if (zone.parentId) {
        const parent = next.find((n) => n.id === zone.parentId);
        if (parent && isZoneNode(parent)) {
          const size = ZONE_DEFAULT_SIZE[zoneKind];
          const fitted = ensureZoneFitsChild(parent, zone.position, size);
          next = next.map((n) => (n.id === parent.id ? fitted : n));
        }
      }
      set({
        nodes: next,
        dirty: true,
        selectedNodeId: id,
        uiNotice: notice,
      });
    });
    if (notice) scheduleClearNotice(set);
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
    if (!node || !block || !isContainerNode(block)) return false;
    if (node.parentId === blockId) return true;
    if (!canNestIntoContainer(node, block, nodes)) {
      if (isArchData(node.data) && isBlockNode(block)) {
        denyNest(set, node.data.label, node.data.kind, block);
      } else {
        set({
          uiNotice: { type: "error", text: "Não é permitido aninhar neste contêiner." },
        });
        scheduleClearNotice(set);
      }
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
    const edgeId = get().selectedEdgeId;
    if (edgeId) {
      withHistory(get, set, () => {
        set({
          edges: get().edges.filter((e) => e.id !== edgeId),
          selectedEdgeId: null,
          dirty: true,
        });
      });
      return;
    }
    const selected = get().selectedNodeId;
    if (!selected) return;
    const nodes = get().nodes;
    const target = nodes.find((n) => n.id === selected);
    if (!target) return;

    withHistory(get, set, () => {
      if (isContainerNode(target)) {
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

    if (isContainerNode(node) && isBlockNode(node)) {
      get().reconcileOrphanCards();
      return;
    }

    const abs = absolutePosition(node, nodes);
    const center = {
      x: abs.x + (isContainerNode(node) ? 80 : 110),
      y: abs.y + (isContainerNode(node) ? 60 : 40),
    };
    const container = findContainerAtPoint(nodes, center, nodeId);

    if (!container) {
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

    if (node.parentId === container.id) return;

    if (!canNestIntoContainer(node, container, nodes)) {
      if (node.parentId) {
        withHistory(get, set, () => {
          set({
            nodes: get().nodes.map((n) => (n.id === nodeId ? detachFromParent(n, get().nodes) : n)),
            dirty: true,
          });
        });
      }
      if (isArchData(node.data) && isBlockNode(container)) {
        denyNest(set, node.data.label, node.data.kind, container);
      }
      return;
    }

    const detached = node.parentId ? detachFromParent(node, nodes) : node;
    const nested = nestInsideBlock(detached, container, nodes);
    withHistory(get, set, () => {
      let next = get().nodes.map((n) => (n.id === nodeId ? nested : n));
      if (isZoneNode(container)) {
        const parent = next.find((n) => n.id === container.id);
        if (parent) {
          const childSize = isZoneNode(nested)
            ? ZONE_DEFAULT_SIZE[nested.data.kind === "zone" ? nested.data.zoneKind : "plane"]
            : { width: 220, height: 78 };
          const fitted = ensureZoneFitsChild(parent, nested.position, childSize);
          next = next.map((n) => (n.id === parent.id ? fitted : n));
        }
      }
      const label = isArchData(node.data)
        ? node.data.label
        : isZoneData(node.data) || isBlockData(node.data)
          ? node.data.label
          : "Item";
      set({
        nodes: next,
        dirty: true,
        uiNotice: {
          type: "success",
          text: `${label} anexado ao contêiner.`,
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
      if (isContainerNode(card) || !isArchData(card.data) || card.parentId) continue;
      const abs = absolutePosition(card, next);
      const center = { x: abs.x + 110, y: abs.y + 40 };
      const block = findContainerAtPoint(next, center, card.id);
      if (!block) continue;
      if (!canNestIntoContainer(card, block, next)) continue;
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
          text: "Cards dentro do contêiner foram associados (agora andam junto).",
        },
      });
    });
    scheduleClearNotice(set);
  },

  updateNodeData: (id, patch) => {
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((node) => {
          if (node.id !== id) return node;
          return { ...node, data: { ...node.data, ...patch } as CanvasNodeData };
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
    const criticalIds = analysis?.score_breakdown?.critical_node_ids ?? [];
    const nodes = get().nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        score: analysis?.node_scores?.[node.id] ?? null,
        summary: analysis?.findings.find((f) => f.node_id === node.id)?.title,
        bottleneck: Boolean(
          analysis?.findings.some(
            (f) => f.node_id === node.id && (f.severity === "warning" || f.severity === "critical"),
          ),
        ),
      },
    }));
    set({ nodes, analysis, analyzeError: null, highlightNodeIds: criticalIds });
  },

  setAnalyzing: (analyzing, error = null) => set({ analyzing, analyzeError: error }),

  loadGraph: (graph) => {
    const edges = ((graph.edges ?? []) as Edge[]).map((e) => {
      const data = normalizeEdgeData(e.data);
      return { ...e, data, ...styleEdgeFromData(data), type: e.type ?? "smoothstep" };
    });
    set({
      graphId: graph.id,
      name: graph.name,
      context: graph.context ?? "",
      nfr: normalizeNfr(graph.nfr),
      nodes: (graph.nodes ?? []) as Node<CanvasNodeData>[],
      edges,
      analysis: graph.analysis,
      dirty: false,
      lastSavedAt: graph.updated_at,
      selectedNodeId: null,
      selectedEdgeId: null,
      uiNotice: null,
      past: [],
      future: [],
      ownerTeam: graph.owner_team ?? "",
      focusedZoneId: null,
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
        selectedEdgeId: null,
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
