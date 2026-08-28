"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Keyboard, Maximize, Minus, Plus, Trash2, Unlink2, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArchNode from "@/components/nodes/ArchNode";
import BlockNode from "@/components/nodes/BlockNode";
import FreeNode from "@/components/nodes/FreeNode";
import SagaNode from "@/components/nodes/SagaNode";
import CircuitBreakerNode from "@/components/nodes/CircuitBreakerNode";
import SecurityGroupNode from "@/components/nodes/SecurityGroupNode";
import SwimlaneNode from "@/components/nodes/SwimlaneNode";
import NaclNode from "@/components/nodes/NaclNode";
import TransitGatewayNode from "@/components/nodes/TransitGatewayNode";
import NoteNode from "@/components/nodes/NoteNode";
import CidrNode from "@/components/nodes/CidrNode";
import TenantBoundaryNode from "@/components/nodes/TenantBoundaryNode";
import DrillDownNavigator from "@/components/canvas/DrillDownNavigator";
import SequenceDiagramView from "@/components/canvas/SequenceDiagramView";
import BlastRadiusOverlay from "@/components/canvas/BlastRadiusOverlay";
import FlowBadgeEdge from "@/components/edges/FlowBadgeEdge";
import ZoneNode from "@/components/nodes/ZoneNode";
import DiagramLegend from "@/components/canvas/DiagramLegend";
import TitleBlock from "@/components/canvas/TitleBlock";
import CanvasBreadcrumbs from "@/components/canvas/CanvasBreadcrumbs";
import ModeBadge from "@/components/canvas/ModeBadge";
import Toolbar from "@/components/ui/Toolbar";
import { findContainerAtPoint, isContainerNode } from "@/lib/blocks";
import { KIND_META } from "@/lib/catalog";
import { useGraphStore } from "@/lib/graph-store";
import { ensureHistoryPersistence } from "@/lib/history-store";
import { computeSnap, type GuideLine } from "@/lib/snap";
import type { CanvasNodeData, NodeKind, SwimlaneKind, ZoneKind } from "@/lib/types";
import { ALL_SWIMLANE_KINDS, ALL_ZONE_KINDS } from "@/lib/types";
import { ZONE_META } from "@/lib/zones";
import { filterVisibility, descendantIds } from "@/lib/canvas-filter";
import CanvasComments from "@/components/canvas/CanvasComments";
import LineageView from "@/components/canvas/LineageView";
import { lodConfig, shouldEnableVisibleElements } from "@/lib/performance";
import { freeLayerFingerprint, sortFreeNodesByLayer, freeLayerOrder } from "@/lib/sort-utils";
import { useProjectStore } from "@/lib/project-store";
import { isFreeData } from "@/lib/types";
const nodeTypes: NodeTypes = {
  arch: ArchNode,
  block: BlockNode,
  zone: ZoneNode,
  free: FreeNode,
  saga: SagaNode,
  circuitBreaker: CircuitBreakerNode,
  securityGroup: SecurityGroupNode,
  nacl: NaclNode,
  transitGateway: TransitGatewayNode,
  swimlane: SwimlaneNode,
  note: NoteNode,
  cidr: CidrNode,
  tenantBoundary: TenantBoundaryNode,
};

const edgeTypes: EdgeTypes = {
  flowBadge: FlowBadgeEdge,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function CanvasInner() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const name = useGraphStore((s) => s.name);
  const nfr = useGraphStore((s) => s.nfr);
  const canvasFilter = useGraphStore((s) => s.canvasFilter);
  const focusedZoneId = useGraphStore((s) => s.focusedZoneId);
  const ownerTeam = useGraphStore((s) => s.ownerTeam);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const addCatalogNode = useGraphStore((s) => s.addCatalogNode);
  const addBlock = useGraphStore((s) => s.addBlock);
  const addZone = useGraphStore((s) => s.addZone);
  const addSwimlane = useGraphStore((s) => s.addSwimlane);
  const setSelectedNodeIds = useGraphStore((s) => s.setSelectedNodeIds);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId);
  const resolveNestingAfterDrag = useGraphStore((s) => s.resolveNestingAfterDrag);
  const checkpointDrag = useGraphStore((s) => s.checkpointDrag);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const addFreeNode = useGraphStore((s) => s.addFreeNode);
  const applyFreeTemplate = useGraphStore((s) => s.applyFreeTemplate);
  const disconnectEdge = useGraphStore((s) => s.disconnectEdge);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const loadSnapshot = useGraphStore((s) => s.loadSnapshot);
  const blastHighlightEdgeIds = useGraphStore((s) => s.blastHighlightEdgeIds);
  const reconcileOrphanCards = useGraphStore((s) => s.reconcileOrphanCards);
  const diagramKind = useGraphStore((s) => s.diagramKind);
  const parentGraphId = useGraphStore((s) => s.parentGraphId);
  const sequenceMode = useGraphStore((s) => s.sequenceMode);
  const isLocked = useGraphStore((s) => s.isLocked);
  const setIsLocked = useGraphStore((s) => s.setIsLocked);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const isFreeMode = projects.find((p) => p.id === activeProjectId)?.project_kind === "free";
  const { screenToFlowPosition, setNodes, fitView, zoomIn, zoomOut } = useReactFlow();
  const [hintsOpen, setHintsOpen] = useState(false);
  const [guidelines, setGuidelines] = useState<GuideLine[]>([]);
  const snapRef = useRef({ active: false, originalPositions: new Map<string, { x: number; y: number }>() });
  const isLockedRef = useRef(isLocked);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [miniMapSize, setMiniMapSize] = useState(140);

  useEffect(() => {
    ensureHistoryPersistence();
  }, []);

  // P2.1.1 + P2.1.3 — LOD: ajustar configurações conforme a escala
  const _lod = useMemo(() => lodConfig(nodes.length), [nodes.length]);

  const layerFp = useMemo(() => freeLayerFingerprint(nodes), [nodes]);

  // Cards que só “parecem” dentro do bloco (sem parentId) passam a andar junto
  useEffect(() => {
    const t = window.setTimeout(() => reconcileOrphanCards(), 0);
    return () => window.clearTimeout(t);
  }, [reconcileOrphanCards]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      // Atalhos para formas no free mode
      if (isFreeMode && !mod) {
        if (key === "r") {
          event.preventDefault();
          const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addFreeNode("free-rectangle", pos);
          return;
        }
        if (key === "c") {
          event.preventDefault();
          const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addFreeNode("free-circle", pos);
          return;
        }
        if (key === "d") {
          event.preventDefault();
          const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addFreeNode("free-diamond", pos);
          return;
        }
        if (key === "t") {
          event.preventDefault();
          const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addFreeNode("free-text", pos);
          return;
        }
        if (key === "n") {
          event.preventDefault();
          const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addFreeNode("free-note", pos);
          return;
        }
      }

      if (mod && key === "0") {
        event.preventDefault();
        void fitView({ padding: 0.2, duration: 300 });
        return;
      }

      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if ((mod && key === "z" && event.shiftKey) || (mod && key === "y") || (event.shiftKey && !mod && key === "z")) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, redo, undo, isFreeMode, screenToFlowPosition, addFreeNode, fitView]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (!selectedNodeIds.length) return;
      const nodeId = selectedNodeIds[0];
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.data.kind !== "free-image") return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            updateNodeData(nodeId, { mediaUrl: dataUrl });
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectedNodeIds, nodes, updateNodeData, isFreeMode]);

  const orderedNodes = useMemo(() => {
    if (isFreeMode) {
      // Containers (nodes with children) render first; siblings sorted by layerOrder (newest on top).
      const hasChildren = new Set(nodes.filter((n) => n.parentId).map((n) => n.parentId!));
      const containers = nodes.filter((n) => hasChildren.has(n.id));
      const rest = nodes.filter((n) => !hasChildren.has(n.id));
      return [...sortFreeNodesByLayer(containers), ...sortFreeNodesByLayer(rest)];
    }

    const containers = nodes.filter((n) => isContainerNode(n));
    const rest = nodes.filter((n) => !isContainerNode(n));
    const depth = (n: (typeof nodes)[0]) => {
      let d = 0;
      let p = n.parentId;
      while (p) {
        d += 1;
        p = nodes.find((x) => x.id === p)?.parentId;
      }
      return d;
    };
    containers.sort((a, b) => depth(b) - depth(a));
    // Non-containers: newest free nodes on top; arch nodes keep insertion order
    const sortedRest = [...rest].sort((a, b) => {
      const aFree = isFreeData(a.data);
      const bFree = isFreeData(b.data);
      if (aFree && bFree && isFreeData(a.data) && isFreeData(b.data)) {
        return freeLayerOrder(a.data, a.id) - freeLayerOrder(b.data, b.id);
      }
      return 0;
    });
    return [...containers, ...sortedRest];
  }, [nodes, isFreeMode, layerFp]);

  const displayEdges = useMemo(() => {
    if (!blastHighlightEdgeIds.length) return edges;
    const highlight = new Set(blastHighlightEdgeIds);
    return edges.map((e) =>
      highlight.has(e.id)
        ? {
            ...e,
            style: { ...e.style, stroke: "#f43f5e", strokeWidth: 3 },
            animated: true,
          }
        : e,
    );
  }, [edges, blastHighlightEdgeIds]);

  const displayNodes = useMemo(() => {
    const filtered = orderedNodes.filter((n) => filterVisibility(n, canvasFilter, ownerTeam));
    return filtered;
  }, [orderedNodes, canvasFilter, ownerTeam]);

  // After applying a template (or loading nodes into an empty canvas), frame the graph.
  const prevNodeCountRef = useRef(0);
  const fitViewTriggeredRef = useRef(false);
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    const next = displayNodes.length;
    prevNodeCountRef.current = next;
    if (next === 0 || next <= prev) {
      fitViewTriggeredRef.current = false;
      return;
    }
    // Jump from empty → populated (template / import) or large grow
    if ((prev === 0 || next - prev >= 3) && !fitViewTriggeredRef.current) {
      fitViewTriggeredRef.current = true;
      const t = window.setTimeout(() => {
        void fitView({ padding: 0.2, duration: 400 });
      }, 50);
      return () => window.clearTimeout(t);
    }
  }, [displayNodes.length, fitView]);

  useEffect(() => {
    if (!focusedZoneId) return;
    const ids = descendantIds(nodes, focusedZoneId);
    const targets = displayNodes.filter((n) => ids.has(n.id));
    if (targets.length === 0) return;
    void fitView({ nodes: targets, padding: 0.25, duration: 450 });
  }, [focusedZoneId, nodes, displayNodes, fitView]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.endsWith(".json") || file.type === "application/json") {
          void (async () => {
            try {
              const { parseImportPayload } = await import("@/lib/export");
              const parsed = await parseImportPayload(JSON.parse(await file.text()));
              loadSnapshot(
                parsed.name,
                parsed.nodes,
                parsed.edges,
                parsed.analysis,
                parsed.context,
                parsed.nfr,
              );
              pushUiNotice({ type: "success", text: `Arquivo "${file.name}" importado.` });
            } catch (err) {
              pushUiNotice({
                type: "error",
                text: err instanceof Error ? err.message : "Falha ao importar arquivo.",
              });
            }
          })();
          return;
        }
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const zoneKind = event.dataTransfer.getData("application/system-design-zone") as ZoneKind | "";
      if (zoneKind && ALL_ZONE_KINDS.includes(zoneKind)) {
        addZone(zoneKind, { x: position.x - 120, y: position.y - 40 });
        return;
      }

      const swimlaneKind = event.dataTransfer.getData("application/system-design-swimlane") as SwimlaneKind | "";
      if (swimlaneKind && ALL_SWIMLANE_KINDS.includes(swimlaneKind)) {
        addSwimlane(swimlaneKind, { x: position.x - 200, y: position.y - 60 });
        return;
      }

      const blockDomain = event.dataTransfer.getData("application/system-design-block") as NodeKind | "";
      if (blockDomain) {
        addBlock(blockDomain, { x: position.x - 160, y: position.y - 40 });
        return;
      }

      const catalogId = event.dataTransfer.getData("application/system-design");
      if (!catalogId) return;

      const container = findContainerAtPoint(nodes, position);
      if (container) {
        const abs = {
          x: container.position.x,
          y: container.position.y,
        };
        // If nested, absolutePosition would be needed — addCatalogNode handles parentId nest
        addCatalogNode(
          catalogId,
          {
            x: Math.max(16, position.x - abs.x - 100),
            y: Math.max(56, position.y - abs.y - 30),
          },
          container.id,
        );
        return;
      }

      addCatalogNode(catalogId, { x: position.x - 100, y: position.y - 30 });
    },
    [addBlock, addCatalogNode, addSwimlane, addZone, loadSnapshot, nodes, pushUiNotice, screenToFlowPosition],
  );

  function startWithZone(kind: ZoneKind) {
    addZone(kind, { x: 80, y: 60 });
    pushUiNotice({
      type: "success",
      text: `Zona ${ZONE_META[kind].label} criada. Arraste AZ/subnets ou serviços para dentro.`,
    });
  }

  function startWith(kind: NodeKind) {
    addBlock(kind, { x: 160, y: 120 });
    pushUiNotice({
      type: "success",
      text: `Bloco ${KIND_META[kind].label} criado. Clique num card na paleta (mesmo domínio) para continuar.`,
    });
  }

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(localStorage.getItem("archia-onboarded") !== "1");
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <Toolbar
        trailing={
          <div className="flex items-center gap-2 pr-1">
            <ModeBadge isFreeMode={isFreeMode} />
          </div>
        }
      >
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1 px-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={() => void zoomIn({ duration: 200 })}
          aria-label="Aumentar zoom"
          title="Zoom +"
        >
          <Plus size={14} aria-hidden />
          <span className="hidden md:inline">Zoom +</span>
        </button>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1 px-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={() => void zoomOut({ duration: 200 })}
          aria-label="Diminuir zoom"
          title="Zoom −"
        >
          <Minus size={14} aria-hidden />
          <span className="hidden md:inline">Zoom −</span>
        </button>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1 px-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={() => void fitView({ padding: 0.2, duration: 300 })}
          aria-label="Ajustar à tela"
          title="Fit view (Ctrl+0)"
          data-testid="fit-view-btn"
        >
          <Maximize size={14} aria-hidden />
          <span className="hidden md:inline">Encaixar</span>
        </button>
        <span className="mx-1 hidden h-5 w-px bg-[var(--border-strong)] sm:block" aria-hidden />
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1 px-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={() => deleteSelected()}
          disabled={selectedNodeIds.length === 0}
          aria-label={
            selectedNodeIds.length > 1
              ? `Remover ${selectedNodeIds.length} itens selecionados`
              : "Remover seleção"
          }
          title="Delete"
        >
          <Trash2 size={14} aria-hidden />
          <span className="hidden md:inline">
            {selectedNodeIds.length > 1 ? `Apagar (${selectedNodeIds.length})` : "Apagar"}
          </span>
        </button>
        <span className="ml-auto text-xs tabular-nums text-[var(--muted-fg)]" aria-live="polite">
          {Math.round(zoomLevel * 100)}%
        </span>
      </Toolbar>

      <div className="relative min-h-0 flex-1">
      {nodes.length === 0 && showOnboarding && !isFreeMode && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)]/95 p-6 elev-4 backdrop-blur text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">Comece desenhando sua primeira arquitetura</p>
            <p className="mt-1 prose-measure mx-auto text-sm leading-relaxed text-[var(--muted)]">
              Selecione um componente à esquerda ou clique para começar rápido
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { kind: "region" as const, label: ZONE_META["region"].short, isZone: true as const },
                { kind: "vpc" as const, label: ZONE_META["vpc"].short, isZone: true as const },
                { kind: "frontend" as const, label: "Frontend", isZone: false as const },
                { kind: "backend" as const, label: "Backend", isZone: false as const },
              ].map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={() => item.isZone ? startWithZone(item.kind as ZoneKind) : startWith(item.kind as NodeKind)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--muted-fg)]">
              Abra o painel de Contexto e escolha um template (MVP, SaaS, Marketplace…)
            </p>
          </div>
        </div>
      )}

      <CanvasBreadcrumbs />

      <div className="pointer-events-none absolute left-3 right-3 top-12 z-20 flex justify-center">
        <div className="pointer-events-auto max-w-xl w-full">
          <DrillDownNavigator diagramKind={diagramKind} parentGraphId={parentGraphId} />
        </div>
      </div>

      {sequenceMode && (
        <div className="pointer-events-auto absolute inset-x-4 top-16 z-20 mx-auto max-w-2xl">
          <SequenceDiagramView
            edges={edges}
            nodes={nodes.map((n) => ({ id: n.id, data: { label: n.data.label } }))}
            onSelectEdge={setSelectedEdgeId}
          />
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-3">
        {/* Atalhos — left */}
        <div className="pointer-events-auto shrink-0">
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5 bg-[var(--surface-1)]/90 text-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={() => setHintsOpen((v) => !v)}
            aria-expanded={hintsOpen}
            aria-label="Mostrar atalhos de teclado"
          >
            <Keyboard size={12} aria-hidden />
            Atalhos
          </button>
          {hintsOpen && (
            <ul className="mt-2 max-w-xs space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/95 p-3 text-sm text-slate-300 elev-3 backdrop-blur">
              <li className="flex gap-2">
                <Unlink2 size={12} className="mt-0.5 shrink-0 text-amber-300" />
                Duplo clique no ponto ou na linha remove a ligação
              </li>
              <li>
                <kbd className="rounded bg-white/10 px-1">Ctrl</kbd>+<kbd className="rounded bg-white/10 px-1">Z</kbd>{" "}
                desfaz · <kbd className="rounded bg-white/10 px-1">Shift</kbd>+
                <kbd className="rounded bg-white/10 px-1">Z</kbd> refaz
              </li>
              <li>
                <kbd className="rounded bg-white/10 px-1">Delete</kbd> remove a seleção
              </li>
              <li>
                <kbd className="rounded bg-white/10 px-1">F</kbd> tela cheia ·{" "}
                <kbd className="rounded bg-white/10 px-1">Esc</kbd> sai
              </li>
              <li>Zonas aninham (VPC → AZ → Subnet); blocos de stack ainda exigem mesmo domínio</li>
              <li>Itens alinham automaticamente ao arrastar</li>
            </ul>
          )}
        </div>
        {/* Title Block — above shortcuts */}
        <div className="pointer-events-none mt-2">
          <TitleBlock
            title={name || "Arquitetura"}
            author="Arquiteto"
            version="1.0"
            nfr={nfr}
            variant="overlay"
          />
        </div>
      </div>

      {/* Bottom right — MiniMap only */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1">
        <label className="pointer-events-auto flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-1)]/90 px-1.5 py-0.5 text-[10px] text-[var(--muted-fg)] backdrop-blur">
          MiniMap
          <input
            type="range"
            min={100}
            max={240}
            value={miniMapSize}
            onChange={(e) => setMiniMapSize(Number(e.target.value))}
            aria-label="Tamanho do minimapa"
            className="w-16"
          />
        </label>
        <MiniMap
          style={{ width: miniMapSize, height: miniMapSize }}
          className="!overflow-hidden !rounded-lg !border !border-[var(--border)] !bg-[var(--surface-1)]"
          maskColor="rgba(2,6,23,0.75)"
          pannable
          zoomable
          nodeColor={(node) =>
            node.type === "zone" ? "#312e81" : node.type === "block" ? "#334155" : node.type === "free" ? "#6366f1" : "#475569"
          }
        />
      </div>

      {/* Alignment guidelines */}
      {guidelines.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {guidelines.map((g) =>
            g.type === "vertical" ? (
              <div
                key={g.id}
                className="absolute w-px"
                style={{
                  left: 0,
                  top: 0,
                  bottom: 0,
                  marginLeft: `${g.position}px`,
                  background: `linear-gradient(180deg, transparent ${Math.max(0, g.min)}px, ${g.color} ${Math.max(0, g.min)}px, ${g.color} ${g.max}px, transparent ${g.max}px)`,
                  opacity: 0.7,
                }}
              />
            ) : (
              <div
                key={g.id}
                className="absolute h-px"
                style={{
                  left: 0,
                  top: 0,
                  right: 0,
                  marginTop: `${g.position}px`,
                  background: `linear-gradient(90deg, transparent ${Math.max(0, g.min)}px, ${g.color} ${Math.max(0, g.min)}px, ${g.color} ${g.max}px, transparent ${g.max}px)`,
                  opacity: 0.7,
                }}
              />
            ),
          )}
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        selectable={!isLocked}
        connectable={!isLocked}
        zoomOnScroll={!isLocked}
        panOnDrag={!isLocked ? [1, 2] : false}
        zoomOnPinch={!isLocked}
        selectionOnDrag={!isLocked}
        selectionMode={isLocked ? undefined : SelectionMode.Partial}
        multiSelectionKeyCode={!isLocked ? "Shift" : undefined}
        onSelectionChange={useCallback(({ nodes: selected, edges: selectedEdges }) => {
          if (isLockedRef.current) return;
          if (selectedEdges?.[0]) {
            setSelectedEdgeId(selectedEdges[0].id);
            return;
          }
          const ids = (selected ?? []).map((n) => n.id);
          setSelectedNodeIds(ids);
        }, [setSelectedEdgeId, setSelectedNodeIds])}
        onEdgeClick={useCallback((_: unknown, edge: { id: string }) => {
          if (isLockedRef.current) return;
          setSelectedEdgeId(edge.id);
        }, [setSelectedEdgeId])}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStart={useCallback((event: unknown, node: { id: string }) => {
          if (isLockedRef.current) return;
          checkpointDrag();
          snapRef.current.active = true;
          snapRef.current.originalPositions = new Map(
            useGraphStore.getState().nodes.map((n) => [n.id, { ...n.position }]),
          );
        }, [checkpointDrag])}
        onNodeDrag={useCallback((event: unknown, draggedNode: { id: string; position: { x: number; y: number } }) => {
          if (!snapRef.current.active || !draggedNode) return;
          if (isLockedRef.current) return;
          if (!_lod.snapEnabled) {
            setGuidelines([]);
            return;
          }
          const allNodes = useGraphStore.getState().nodes;
          if (allNodes.length > 120) {
            setGuidelines([]);
            return;
          }
          const result = computeSnap(draggedNode.id, draggedNode.position, allNodes);
          if (result.guidelines.length > 0) {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id !== draggedNode.id) return n;
                return { ...n, position: { x: result.x, y: result.y } };
              }),
            );
          }
          setGuidelines(result.guidelines);
        }, [_lod, setNodes, setGuidelines])}
        onNodeDragStop={useCallback((_event: unknown, node: { id: string } | null) => {
          if (isLockedRef.current) return;
          snapRef.current.active = false;
          setGuidelines([]);
          if (node) resolveNestingAfterDrag(node.id);
        }, [resolveNestingAfterDrag, setGuidelines])}
        onEdgeDoubleClick={useCallback((_event: unknown, edge: { id: string }) => {
          if (isLockedRef.current) return;
          disconnectEdge(edge.id);
        }, [disconnectEdge])}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        connectionLineStyle={{ stroke: "var(--accent)", strokeWidth: 2 }}
        defaultEdgeOptions={{ type: "smoothstep", animated: _lod.animatedEdges }}
        onlyRenderVisibleElements={shouldEnableVisibleElements(nodes.length, isFreeMode)}
        onMove={(_, vp) => {
          // P2.1.3 — tracking zoom level for semantic LOD (xyflow v12)
          setZoomLevel(vp.zoom);
        }}
        proOptions={{ hideAttribution: true }}
        aria-label="Canvas de arquitetura"
        minZoom={0.08}
        maxZoom={1.75}
      >
        {!sequenceMode && (
          <>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(30,41,59,0.5)" />
            {/* Templates button for free mode */}
            {isFreeMode && nodes.length === 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyFreeTemplate("simple-flow")}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/95 px-3 py-2 text-xs text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Aplicar template fluxo simples"
                >
                  <Zap className="h-3 w-3" aria-hidden />
                  Fluxo simples
                </button>
                <button
                  type="button"
                  onClick={() => applyFreeTemplate("decision-tree")}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/95 px-3 py-2 text-xs text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Aplicar template árvore de decisão"
                >
                  <Zap className="h-3 w-3" aria-hidden />
                  Árvore decisão
                </button>
                <button
                  type="button"
                  onClick={() => applyFreeTemplate("process")}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/95 px-3 py-2 text-xs text-[var(--foreground)] backdrop-blur transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Aplicar template processo"
                >
                  <Zap className="h-3 w-3" aria-hidden />
                  Processo
                </button>
              </div>
            )}
          </>
        )}
      </ReactFlow>
      {!sequenceMode && !isFreeMode && (
        <>
          <CanvasComments />
          <LineageView />
          <BlastRadiusOverlay />
        </>
      )}
      </div>
    </div>
  );
}

export default function DesignCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
