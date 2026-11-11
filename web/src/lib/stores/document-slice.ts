/**
 * P4 — document slice do graph-store (split do god-store).
 *
 * Estado + ações de documento/nós/arestas movidos VERBATIM de graph-store.ts
 * (comentários preservados). A única mudança: `_pendingTimeout` saiu do
 * state para escopo de módulo (exigência P4).
 */
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
} from "@xyflow/react";
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
} from "../blocks";
import { buildArchEdge, nextFlowNumber, normalizeEdgeData, styleEdgeFromData } from "../edges";
import { findCatalog } from "../catalog";
import { checkRecommendations } from "../stack-recommend";
import { FREE_NODE_DEFAULT_SIZE, findFreeCatalog } from "../free-catalog";
import { freeLayerOrder, nextFreeLayerOrder } from "../free-layer";
import type { ArchNodeData, CanvasNodeData, FreeNodeKind } from "../types";
import { isArchData, isBlockData, isFreeData, isZoneData } from "../types";
import { emptyNfr, normalizeNfr } from "../nfr";
import { createSwimlaneNode } from "../swimlanes";
import { createZoneNode, ensureZoneFitsChild, isZoneNode, ZONE_DEFAULT_SIZE } from "../zones";
import { EMPTY_CANVAS_FILTER } from "../canvas-filter";
import { applyFixAction } from "../fix-actions";
import { autoLayoutByZones } from "../auto-layout";
import {
  denyNest,
  edgeTouchesHandle,
  HISTORY_LIMIT,
  nextId,
  scheduleClearNotice,
  takeSnapshot,
  withHistory,
} from "./helpers";
import type { GraphState, UiNotice } from "./types";
import type { StoreApi } from "zustand";

type SetFn = StoreApi<GraphState>["setState"];
type GetFn = () => GraphState;

// P4: pendências de onNodesChange fora do state (antes era _pendingTimeout).
let _pendingTimeout: ReturnType<typeof setTimeout> | null = null;

export function documentSlice(
  set: SetFn,
  get: GetFn,
): Pick<
  GraphState,
  | "name"
  | "context"
  | "nfr"
  | "graphId"
  | "projectId"
  | "nodes"
  | "edges"
  | "selectedNodeId"
  | "selectedNodeIds"
  | "selectedEdgeId"
  | "excalidrawElements"
  | "selectedExcalidrawElementId"
  | "_pendingNodesChanges"
  | "setName"
  | "setContext"
  | "setNfr"
  | "addPatternNodes"
  | "applyFixFromFinding"
  | "applyTemplate"
  | "onNodesChange"
  | "onEdgesChange"
  | "onConnect"
  | "updateEdgeData"
  | "disconnectHandle"
  | "disconnectEdge"
  | "addCatalogNode"
  | "addBlock"
  | "addZone"
  | "addSwimlane"
  | "addNote"
  | "addFreeNode"
  | "generateDiagramFromText"
  | "applyFreeTemplate"
  | "moveFreeNodeLayer"
  | "addCidrBlock"
  | "addTenantBoundary"
  | "applyAutoLayout"
  | "setC4Level"
  | "setSelectedNodeId"
  | "setSelectedNodeIds"
  | "setSelectedEdgeId"
  | "setExcalidrawElements"
  | "setSelectedExcalidrawElementId"
  | "renameNode"
  | "attachNodeToBlock"
  | "detachNode"
  | "deleteSelected"
  | "checkpointDrag"
  | "resolveNestingAfterDrag"
  | "reconcileOrphanCards"
  | "updateNodeData"
  | "updateNodeConfig"
  | "loadGraph"
  | "loadSnapshot"
  | "applyRemote"
  | "reset"
> {
  return {
  name: "Nova arquitetura",
  context: "",
  nfr: emptyNfr(),
  graphId: null,
  projectId: null, // NEW: track project association
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  excalidrawElements: [],
  selectedExcalidrawElementId: null,
  _pendingNodesChanges: null,

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
        selectedEdgeId: null,
        graphId: null,
        canvasFilter: { ...EMPTY_CANVAS_FILTER },
        focusedZoneId: null,
        uiNotice: {
          type: "success",
          text: `Template “${template.label}” aplicado (${built.nodes.length} nós). Ajuste NFRs e rode a Análise.`,
        },
      });
      scheduleClearNotice(set);
    });
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
    const prevTimer = _pendingTimeout;
    if (prevTimer !== null) clearTimeout(prevTimer);
    const timer = setTimeout(() => {
      set({ _pendingNodesChanges: null });
      _pendingTimeout = null;
      const applied = applyNodeChanges(pending, get().nodes);
      set({ nodes: applied, dirty: true });
    }, 150);
    set({ _pendingNodesChanges: pending });
    _pendingTimeout = timer;
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
    const nodeType =
      catalogId === "pat-circuit-breaker"
        ? "circuitBreaker"
        : catalogId === "sec-sg"
          ? "securityGroup"
          : catalogId === "net-nacl"
            ? "nacl"
            : catalogId === "net-tgw"
              ? "transitGateway"
              : "arch";
    const defaultCb =
      nodeType === "circuitBreaker"
        ? { failure_threshold: 5, window_seconds: 60, state: "closed" as const }
        : undefined;
    const defaultSgRules =
      nodeType === "securityGroup"
        ? [{ port: "443", protocol: "tcp" as const, direction: "inbound" as const, description: "HTTPS" }]
        : undefined;
    const defaultNaclRules =
      nodeType === "nacl"
        ? [
            { rule_number: 100, action: "allow" as const, protocol: "tcp" as const, port_range: "443", cidr: "0.0.0.0/0", direction: "inbound" as const },
            { rule_number: 32767, action: "deny" as const, protocol: "all" as const, direction: "inbound" as const },
          ]
        : undefined;
    const defaultTgwAttachments =
      nodeType === "transitGateway"
        ? [{ vpc_id: "vpc-a", vpc_label: "VPC App", route_table: "rt-main" }]
        : undefined;
    let node: Node<CanvasNodeData> = {
      id,
      type: nodeType,
      position,
      data: {
        kind: item.kind,
        label: item.label,
        catalogId: item.id,
        tech: item.tech,
        config: { ...item.defaults },
        score: null,
        circuitBreaker: defaultCb,
        securityGroupRules: defaultSgRules,
        naclRules: defaultNaclRules,
        tgwAttachments: defaultTgwAttachments,
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

  addSwimlane: (swimlaneKind, position, opts) => {
    const id = nextId("lane");
    let lane = createSwimlaneNode(id, swimlaneKind, position, opts);
    const nodes = get().nodes;
    const atPoint = findContainerAtPoint(nodes, {
      x: position.x + 80,
      y: position.y + 40,
    });
    let notice: UiNotice | null = null;
    if (atPoint && canNestIntoContainer(lane, atPoint, nodes)) {
      lane = nestInsideBlock(lane, atPoint, nodes) as typeof lane;
      notice = { type: "success", text: `Swimlane aninhada.` };
    }
    withHistory(get, set, () => {
      set({
        nodes: [...get().nodes, lane],
        dirty: true,
        selectedNodeId: id,
        uiNotice: notice,
      });
    });
    if (notice) scheduleClearNotice(set);
  },

  addNote: (position, text = "Nova nota") => {
    const id = nextId("note");
    withHistory(get, set, () => {
      set({
        nodes: [
          ...get().nodes,
          {
            id,
            type: "note",
            position,
            data: { kind: "note", label: text.slice(0, 40), text },
          },
        ],
        dirty: true,
        selectedNodeId: id,
      });
    });
  },

  addFreeNode: (kind, position, label) => {
    const id = nextId("free");
    const size = FREE_NODE_DEFAULT_SIZE[kind];
    const layerOrder = nextFreeLayerOrder(get().nodes);
    const catalog = findFreeCatalog(kind);
    const defaultLabel =
      label ??
      (kind === "free-text"
        ? "Texto"
        : kind === "free-diamond"
          ? "Decisão"
          : kind === "free-note"
            ? "Nota"
            : kind === "free-link"
              ? "Link"
              : kind === "free-image"
                ? "Imagem"
                : kind === "free-video"
                  ? "Vídeo"
                  : kind === "free-audio"
                    ? "Áudio"
                    : "Novo");
    withHistory(get, set, () => {
      set({
        nodes: [
          ...get().nodes,
          {
            id,
            type: "free",
            position,
            style: { width: size.width, height: size.height },
            data: {
              kind,
              label: defaultLabel,
              layerOrder,
              ...(catalog?.defaultIcon ? { iconId: catalog.defaultIcon, iconSize: 16 } : {}),
              ...(kind === "free-text" || kind === "free-edit" ? { text: defaultLabel } : {}),
              ...(kind === "free-note" ? { notes: "", backgroundColor: "#fef08a", textColor: "#422006" } : {}),
              ...(kind === "free-link" ? { linkUrl: "https://" } : {}),
            },
          },
        ],
        dirty: true,
        selectedNodeId: id,
      });
    });
  },

  generateDiagramFromText: (text, name) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").trim());

    if (lines.length === 0) {
      get().pushUiNotice({ type: "error", text: "Nenhuma linha encontrada no texto." });
      return { nodeId: "", nodeCount: 0, edgeCount: 0 };
    }

    const startX = 200;
    const startY = 100;
    const spacingY = 160;

    const newNodes: Node<CanvasNodeData>[] = [];
    const newEdges: Edge[] = [];
    let lastNodeId = "";
    const currentLayerOrder = nextFreeLayerOrder(get().nodes);

    lines.forEach((line, i) => {
      const nodeId = nextId("free");
      const node = {
        id: nodeId,
        type: "free" as const,
        position: { x: startX, y: startY + i * spacingY },
        style: { width: FREE_NODE_DEFAULT_SIZE["free-rectangle"].width, height: FREE_NODE_DEFAULT_SIZE["free-rectangle"].height },
        data: {
          kind: "free-rectangle" as FreeNodeKind,
          label: line,
          layerOrder: currentLayerOrder + i,
        },
      };
      newNodes.push(node);

      if (i > 0 && lastNodeId) {
        const edgeId = `e-${lastNodeId}-${nodeId}`;
        const edgeData = normalizeEdgeData({});
        const edgeStyle = styleEdgeFromData(edgeData);
        const edge: Edge = {
          id: edgeId,
          source: lastNodeId,
          target: nodeId,
          type: "smoothstep" as const,
          data: edgeData,
          ...edgeStyle,
        };
        newEdges.push(edge);
      }
      lastNodeId = nodeId;
    });

    withHistory(get, set, () => {
      set({
        nodes: [...get().nodes, ...newNodes],
        edges: [...get().edges, ...newEdges],
        dirty: true,
        selectedNodeId: newNodes[0]?.id ?? null,
        uiNotice: { type: "success", text: `Diagrama gerado: ${lines.length} nós, ${lines.length - 1} conexões.` },
      });
      scheduleClearNotice(set);
    });

    return { nodeId: newNodes[0]?.id ?? "", nodeCount: newNodes.length, edgeCount: newEdges.length };
  },

  applyFreeTemplate: (templateId) => {
    const templates: Record<string, { nodes: Array<{ kind: FreeNodeKind; label: string; x: number; y: number }>; edges: Array<{ source: string; target: string }> }> = {
      "simple-flow": {
        nodes: [
          { kind: "free-rectangle", label: "Início", x: 200, y: 100 },
          { kind: "free-rectangle", label: "Processo 1", x: 200, y: 300 },
          { kind: "free-rectangle", label: "Processo 2", x: 200, y: 500 },
          { kind: "free-circle", label: "Fim", x: 200, y: 700 },
        ],
        edges: [
          { source: "0", target: "1" },
          { source: "1", target: "2" },
          { source: "2", target: "3" },
        ],
      },
      "decision-tree": {
        nodes: [
          { kind: "free-circle", label: "Início", x: 200, y: 80 },
          { kind: "free-diamond", label: "Decisão?", x: 200, y: 250 },
          { kind: "free-rectangle", label: "Sim → Ação", x: 80, y: 450 },
          { kind: "free-rectangle", label: "Não → Outro", x: 320, y: 450 },
          { kind: "free-circle", label: "Fim", x: 200, y: 650 },
        ],
        edges: [
          { source: "0", target: "1" },
          { source: "1", target: "2" },
          { source: "1", target: "3" },
          { source: "2", target: "4" },
          { source: "3", target: "4" },
        ],
      },
      "process": {
        nodes: [
          { kind: "free-oval", label: "Input", x: 200, y: 80 },
          { kind: "free-hexagon", label: "Processar", x: 200, y: 250 },
          { kind: "free-rectangle", label: "Validar", x: 200, y: 420 },
          { kind: "free-check", label: "Aprovado", x: 80, y: 600 },
          { kind: "free-x", label: "Rejeitado", x: 320, y: 600 },
        ],
        edges: [
          { source: "0", target: "1" },
          { source: "1", target: "2" },
          { source: "2", target: "3" },
          { source: "2", target: "4" },
        ],
      },
    };

    const template = templates[templateId];
    if (!template) return;

    const newNodes: Node<CanvasNodeData>[] = [];
    const newEdges: Edge[] = [];
    const currentLayerOrder = nextFreeLayerOrder(get().nodes);

    template.nodes.forEach((nodeDef, i) => {
      const nodeId = nextId("free");
      newNodes.push({
        id: nodeId,
        type: "free" as const,
        position: { x: nodeDef.x, y: nodeDef.y },
        style: { width: FREE_NODE_DEFAULT_SIZE[nodeDef.kind].width, height: FREE_NODE_DEFAULT_SIZE[nodeDef.kind].height },
        data: {
          kind: nodeDef.kind,
          label: nodeDef.label,
          layerOrder: currentLayerOrder + i,
        },
      });
    });

    template.edges.forEach((edgeDef, i) => {
      const sourceNode = template.nodes[parseInt(edgeDef.source)];
      const targetNode = template.nodes[parseInt(edgeDef.target)];
      if (!sourceNode || !targetNode) return;

      const sourceId = newNodes[parseInt(edgeDef.source)]?.id;
      const targetId = newNodes[parseInt(edgeDef.target)]?.id;
      if (!sourceId || !targetId) return;

      const edgeId = `e-${sourceId}-${targetId}`;
      const edgeData = normalizeEdgeData({});
      const edgeStyle = styleEdgeFromData(edgeData);
      newEdges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: "smoothstep" as const,
        data: edgeData,
        ...edgeStyle,
      });
    });

    withHistory(get, set, () => {
      set({
        nodes: [...get().nodes, ...newNodes],
        edges: [...get().edges, ...newEdges],
        dirty: true,
        selectedNodeId: newNodes[0]?.id ?? null,
        uiNotice: { type: "success", text: `Template "${templateId}" aplicado` },
      });
      scheduleClearNotice(set);
    });
  },

  moveFreeNodeLayer: (nodeId, direction) => {
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !isFreeData(node.data)) return;

    const siblings = nodes.filter(
      (n) => isFreeData(n.data) && (n.parentId ?? null) === (node.parentId ?? null),
    );
    const ordered = siblings
      .map((n) => ({
        id: n.id,
        order: isFreeData(n.data) ? freeLayerOrder(n.data, n.id) : 0,
      }))
      .sort((a, b) => a.order - b.order);

    const idx = ordered.findIndex((o) => o.id === nodeId);
    if (idx < 0) return;

    const updates = new Map<string, number>();

    if (direction === "front") {
      const max = Math.max(...ordered.map((o) => o.order));
      updates.set(nodeId, max + 1);
    } else if (direction === "back") {
      const min = Math.min(...ordered.map((o) => o.order));
      updates.set(nodeId, min - 1);
    } else if (direction === "forward" && idx < ordered.length - 1) {
      const next = ordered[idx + 1];
      updates.set(nodeId, next.order + 0.5);
    } else if (direction === "backward" && idx > 0) {
      const prev = ordered[idx - 1];
      updates.set(nodeId, prev.order - 0.5);
    } else {
      return;
    }

    withHistory(get, set, () => {
      const nextNodes = get().nodes.map((n) => {
        if (!updates.has(n.id) || !isFreeData(n.data)) return n;
        return {
          ...n,
          data: { ...n.data, layerOrder: updates.get(n.id)! },
        };
      });
      // Normalize layer orders to integers
      const freeSorted = nextNodes
        .filter((n) => isFreeData(n.data))
        .sort((a, b) => {
          if (!isFreeData(a.data) || !isFreeData(b.data)) return 0;
          return freeLayerOrder(a.data, a.id) - freeLayerOrder(b.data, b.id);
        });
      const normalized = new Map<string, number>();
      freeSorted.forEach((n, i) => normalized.set(n.id, i + 1));
      set({
        nodes: nextNodes.map((n) => {
          if (!isFreeData(n.data) || !normalized.has(n.id)) return n;
          return { ...n, data: { ...n.data, layerOrder: normalized.get(n.id) } };
        }),
        dirty: true,
      });
    });
  },

  addCidrBlock: (position, cidr = "10.0.0.0/16", label = "VPC CIDR") => {
    const id = nextId("cidr");
    withHistory(get, set, () => {
      set({
        nodes: [
          ...get().nodes,
          {
            id,
            type: "cidr",
            position,
            data: { kind: "cidr", label, cidr },
          },
        ],
        dirty: true,
        selectedNodeId: id,
      });
    });
  },

  addTenantBoundary: (position, opts) => {
    const id = nextId("tenant");
    withHistory(get, set, () => {
      set({
        nodes: [
          ...get().nodes,
          {
            id,
            type: "tenantBoundary",
            position,
            data: {
              kind: "tenant_boundary",
              label: opts?.label ?? "Tenant boundary",
              tenantMode: opts?.tenantMode ?? "silo",
              tenantIds: [],
            },
          },
        ],
        dirty: true,
        selectedNodeId: id,
      });
    });
  },

  applyAutoLayout: () => {
    withHistory(get, set, () => {
      const laid = autoLayoutByZones(get().nodes, get().edges);
      set({ nodes: laid, dirty: true, uiNotice: { type: "success", text: "Layout organizado por zonas." } });
    });
    scheduleClearNotice(set);
  },

  setC4Level: (nodeId, level) => {
    withHistory(get, set, () => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId && isArchData(n.data) ? { ...n, data: { ...n.data, c4Level: level } } : n,
        ),
        dirty: true,
      });
    });
  },

  setSelectedNodeId: (selectedNodeId) =>
    set({
      selectedNodeId,
      selectedNodeIds: selectedNodeId ? [selectedNodeId] : [],
      selectedEdgeId: null,
    }),

  setSelectedNodeIds: (selectedNodeIds) =>
    set({
      selectedNodeIds,
      selectedNodeId: selectedNodeIds[0] ?? null,
      selectedEdgeId: null,
    }),

  setSelectedEdgeId: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null, selectedNodeIds: [] }),

  setExcalidrawElements: (elements) => {
    const SENTINEL_ID = "__excalidraw_scene__";
    const prev = get().nodes.filter((n) => n.id !== SENTINEL_ID);
    const sentinel: Node<CanvasNodeData> = {
      id: SENTINEL_ID,
      type: "default",
      position: { x: 0, y: 0 },
      data: {
        kind: "note",
        label: "__excalidraw_scene__",
        // Persist free-diagram scene so PUT /graphs isolates per project
        text: JSON.stringify(elements),
      },
      hidden: true,
    };
    set({
      excalidrawElements: elements,
      nodes: [...prev, sentinel],
      dirty: true,
    });
  },

  setSelectedExcalidrawElementId: (id) => set({ selectedExcalidrawElementId: id }),

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
    const ids = get().selectedNodeIds.length
      ? get().selectedNodeIds
      : get().selectedNodeId
        ? [get().selectedNodeId!]
        : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    withHistory(get, set, () => {
      let next = get().nodes.filter((n) => !idSet.has(n.id));
      // Detach children of deleted containers
      next = next.map((n) =>
        n.parentId && idSet.has(n.parentId) ? detachFromParent(n, get().nodes) : n,
      );
      set({
        nodes: next,
        edges: get().edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
        selectedNodeId: null,
        selectedNodeIds: [],
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

  loadGraph: (graph) => {
    const edges = ((graph.edges ?? []) as Edge[]).map((e) => {
      const data = normalizeEdgeData(e.data);
      return { ...e, data, ...styleEdgeFromData(data), type: e.type ?? "smoothstep" };
    });
    // 关键修复：优先从后端响应中恢复 Excalidraw 元素，否则从 sentinel 节点恢复
    const freeScene = graph.excalidraw_elements && graph.excalidraw_elements.length > 0
      ? graph.excalidraw_elements
      : (() => {
          const raw = (graph.nodes ?? []) as Array<{
            id?: string;
            data?: { kind?: string; label?: string; text?: string; notes?: string; elements?: unknown };
          }>;
          const sentinel = raw.find(
            (n) => n?.id === "__excalidraw_scene__" || n?.data?.label === "__excalidraw_scene__",
          );
          if (!sentinel?.data) return [];
          if (Array.isArray(sentinel.data.elements)) {
            return sentinel.data.elements as import("@excalidraw/excalidraw/element/types").ExcalidrawElement[];
          }
          const payload = sentinel.data.text ?? sentinel.data.notes;
          if (typeof payload === "string" && payload.trim()) {
            try {
              const parsed = JSON.parse(payload) as unknown;
              return Array.isArray(parsed)
                ? (parsed as import("@excalidraw/excalidraw/element/types").ExcalidrawElement[])
                : [];
            } catch {
              return [];
            }
          }
          return [];
        })();
    set({
      graphId: graph.id,
      projectId: graph.project_id ?? null,
      name: graph.name,
      context: graph.context ?? "",
      nfr: normalizeNfr(graph.nfr),
      nodes: (graph.nodes ?? []) as Node<CanvasNodeData>[],
      edges,
      analysis: graph.analysis,
      dirty: false,
      lastSavedAt: graph.updated_at,
      lastEtag: graph.etag ?? null,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      uiNotice: null,
      past: [],
      future: [],
      ownerTeam: graph.owner_team ?? "",
      focusedZoneId: null,
      diagramKind: graph.diagram_kind ?? null,
      parentGraphId: graph.parent_graph_id ?? null,
      c4ParentNodeId: graph.c4_parent_node_id ?? null,
      sequenceMode: graph.diagram_kind === "sequence",
      excalidrawElements: freeScene,
      selectedExcalidrawElementId: null,
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
        selectedNodeIds: [],
        uiNotice: null,
        // 关键修复：加载快照时清空 Excalidraw 元素
        excalidrawElements: [],
        selectedExcalidrawElementId: null,
      });
    });
  },

  applyRemote: (remote) => {
    // Estado remoto (colaboração): nunca vira undo, nunca marca dirty
    // (auto-save não deve persistir edição de outro usuário) e o estado de
    // Excalidraw só é substituído quando o payload explicitamente o carrega.
    // Fields ausentes no payload não são sobrescritos.
    const current = get();
    const updates: Partial<GraphState> = {};
    if (remote.nodes !== undefined) {
      const ids = new Set(remote.nodes.map((n) => n.id));
      updates.nodes = remote.nodes;
      updates.edges = (remote.edges ?? current.edges).filter(
        (e) => ids.has(e.source) && ids.has(e.target),
      );
    } else if (remote.edges !== undefined) {
      updates.edges = remote.edges;
    }
    if (remote.excalidrawElements !== undefined) {
      updates.excalidrawElements = remote.excalidrawElements;
      updates.selectedExcalidrawElementId = null;
    }
    if (remote.name !== undefined) updates.name = remote.name;
    if (remote.analysis !== undefined) updates.analysis = remote.analysis;
    if (remote.context !== undefined) updates.context = remote.context ?? "";
    if (remote.nfr !== undefined) updates.nfr = normalizeNfr(remote.nfr);
    set(updates);
  },

  reset: () => {
    console.log("[GraphStore] reset() called");
    withHistory(get, set, () => {
      set({
        name: "Nova arquitetura",
        context: "",
        nfr: emptyNfr(),
        graphId: null,
        projectId: null,
        nodes: [],
        edges: [],
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        analysis: null,
        analyzing: false,
        analyzeError: null,
        uiNotice: null,
        dirty: false,
        lastSavedAt: null,
        // Critical: clear free-diagram scene so projects never share Excalidraw state
        excalidrawElements: [],
        selectedExcalidrawElementId: null,
        diagramKind: null,
        parentGraphId: null,
        c4ParentNodeId: null,
        sequenceMode: false,
        past: [],
        future: [],
        saveStatus: "saved",
      });
    });
    console.log("[GraphStore] reset() complete — excalidrawElements cleared");
  },
  };
}
