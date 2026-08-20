"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Boxes, Keyboard, MousePointerClick, Share2, Unlink2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArchNode from "@/components/nodes/ArchNode";
import BlockNode from "@/components/nodes/BlockNode";
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
import { findContainerAtPoint, isContainerNode } from "@/lib/blocks";
import { KIND_META } from "@/lib/catalog";
import { useGraphStore } from "@/lib/graph-store";
import { computeSnap, type GuideLine } from "@/lib/snap";
import type { CanvasNodeData, NodeKind, SwimlaneKind, ZoneKind } from "@/lib/types";
import { ALL_SWIMLANE_KINDS, ALL_ZONE_KINDS } from "@/lib/types";
import { ZONE_META } from "@/lib/zones";
import { FLOW_KIND_META } from "@/lib/edges";
import { filterVisibility, descendantIds } from "@/lib/canvas-filter";
import CanvasComments from "@/components/canvas/CanvasComments";
import LineageView from "@/components/canvas/LineageView";
import { lodConfig, shouldEnableVisibleElements } from "@/lib/performance";

const nodeTypes: NodeTypes = {
  arch: ArchNode,
  block: BlockNode,
  zone: ZoneNode,
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
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId);
  const resolveNestingAfterDrag = useGraphStore((s) => s.resolveNestingAfterDrag);
  const checkpointDrag = useGraphStore((s) => s.checkpointDrag);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const disconnectEdge = useGraphStore((s) => s.disconnectEdge);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const blastHighlightEdgeIds = useGraphStore((s) => s.blastHighlightEdgeIds);
  const reconcileOrphanCards = useGraphStore((s) => s.reconcileOrphanCards);
  const diagramKind = useGraphStore((s) => s.diagramKind);
  const parentGraphId = useGraphStore((s) => s.parentGraphId);
  const sequenceMode = useGraphStore((s) => s.sequenceMode);
  const { screenToFlowPosition, setNodes, fitView } = useReactFlow();
  const [hintsOpen, setHintsOpen] = useState(false);
  const [guidelines, setGuidelines] = useState<GuideLine[]>([]);
  const snapRef = useRef({ active: false, originalPositions: new Map<string, { x: number; y: number }>() });
  const [zoomLevel, setZoomLevel] = useState(1);

  // P2.1.1 + P2.1.3 — LOD: ajustar configurações conforme a escala
  const _lod = useMemo(() => lodConfig(nodes.length), [nodes.length]);

  // P2.1.3 — zoom semântico: badge mostra nível de zoom atual

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
  }, [deleteSelected, redo, undo]);

  const orderedNodes = useMemo(() => {
    const containers = nodes.filter((n) => isContainerNode(n));
    const rest = nodes.filter((n) => !isContainerNode(n));
    // parents before children for React Flow nesting
    const depth = (n: (typeof nodes)[0]) => {
      let d = 0;
      let p = n.parentId;
      while (p) {
        d += 1;
        p = nodes.find((x) => x.id === p)?.parentId;
      }
      return d;
    };
    containers.sort((a, b) => depth(a) - depth(b));
    return [...containers, ...rest];
  }, [nodes]);

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
    [addBlock, addCatalogNode, addSwimlane, addZone, nodes, screenToFlowPosition],
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

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-lg rounded-2xl border border-white/10 bg-[#0d1219]/95 p-6 shadow-2xl backdrop-blur">
            <p className="text-center text-lg font-semibold text-slate-50">Comece em 3 passos</p>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span>
                  <strong className="text-slate-100">1. Zona</strong> — Region / VPC / AZ / Plane (arquitetura real).
                </span>
              </li>
              <li className="flex gap-3">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>
                  <strong className="text-slate-100">2. Serviços</strong> — cards multi-cloud dentro das zonas.
                </span>
              </li>
              <li className="flex gap-3">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>
                  <strong className="text-slate-100">3. Fluxos</strong> — ligações tipadas (sync/async) com número.
                </span>
              </li>
            </ol>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["region", "vpc", "plane", "security_boundary"] as ZoneKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="btn-ghost flex items-center justify-center gap-1.5 py-2"
                  onClick={() => startWithZone(kind)}
                >
                  {ZONE_META[kind].short}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["frontend", "backend", "database", "cloud"] as NodeKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="btn-ghost flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-400"
                  onClick={() => startWith(kind)}
                >
                  Bloco {KIND_META[kind].label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-500">
              Ou abra <strong className="text-slate-400">Contexto</strong> e escolha um template (MVP, SaaS, Marketplace…).
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex justify-center">
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

      <div className="pointer-events-none absolute bottom-3 left-3 z-10">
        <div className="pointer-events-auto">
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5 bg-[#0d1219]/90 text-[11px] backdrop-blur"
            onClick={() => setHintsOpen((v) => !v)}
            aria-expanded={hintsOpen}
          >
            <Keyboard size={12} />
            Atalhos
          </button>
          {hintsOpen && (
            <ul className="mt-2 max-w-xs space-y-1.5 rounded-xl border border-white/10 bg-[#0d1219]/95 p-3 text-[11px] text-slate-300 shadow-xl backdrop-blur">
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
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-10">
        <div className="pointer-events-none rounded-xl border border-white/10 bg-[#0d1219]/90 px-3 py-2 text-[10px] text-slate-400 backdrop-blur">
          <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Fluxos</p>
          <ul className="space-y-1">
            {(Object.keys(FLOW_KIND_META) as (keyof typeof FLOW_KIND_META)[]).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-6"
                  style={{
                    background: FLOW_KIND_META[k].stroke,
                    borderTop: FLOW_KIND_META[k].dash ? `1px dashed ${FLOW_KIND_META[k].stroke}` : undefined,
                  }}
                />
                {FLOW_KIND_META[k].label}
              </li>
            ))}
          </ul>
        </div>
        {/* P2.1.1 — badge de escala */}
        <div className="pointer-events-none mt-1 rounded-xl border border-white/10 bg-[#0d1219]/90 px-2 py-1.5 text-[10px] text-slate-500 backdrop-blur">
          <span className={nodes.length >= 500 ? "text-amber-400" : nodes.length >= 150 ? "text-cyan-400" : ""}>
            {nodes.length} nós · {_lod.snapEnabled ? "snap" : "no-snap"}
          </span>
          {/* P2.1.3 — zoom semântico LOD */}
          <span className="ml-2 text-slate-600">·</span>
          <span className="ml-1">
            {zoomLevel < 0.3 ? "zoom-out" : zoomLevel < 0.8 ? "subsystem" : zoomLevel < 1.3 ? "service" : "resource"}
          </span>
        </div>
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
        onSelectionChange={({ nodes: selected, edges: selectedEdges }) => {
          if (selectedEdges?.[0]) {
            setSelectedEdgeId(selectedEdges[0].id);
            return;
          }
          setSelectedNodeId(selected[0]?.id ?? null);
        }}
        onEdgeClick={(_e, edge) => setSelectedEdgeId(edge.id)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStart={(event, node) => {
          checkpointDrag();
          // Store original positions of all nodes for snap
          snapRef.current.active = true;
          snapRef.current.originalPositions = new Map(
            useGraphStore.getState().nodes.map((n) => [n.id, { ...n.position }]),
          );
        }}
        onNodeDrag={(event, draggedNode) => {
          if (!snapRef.current.active || !draggedNode) return;
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
            // Snap: override the dragged node position
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id !== draggedNode.id) return n;
                return { ...n, position: { x: result.x, y: result.y } };
              }),
            );
          }
          setGuidelines(result.guidelines);
        }}
        onNodeDragStop={(_event, node) => {
          snapRef.current.active = false;
          setGuidelines([]);
          if (node) resolveNestingAfterDrag(node.id);
        }}
        onEdgeDoubleClick={(_event, edge) => {
          disconnectEdge(edge.id);
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={null}
        connectionLineStyle={{ stroke: "#22d3ee", strokeWidth: 2 }}
        defaultEdgeOptions={{ type: "smoothstep", animated: _lod.animatedEdges }}
        onlyRenderVisibleElements={shouldEnableVisibleElements(nodes.length)}
        onZoom={(state) => {
          // P2.1.3 — tracking zoom level for semantic LOD
          setZoomLevel(state.transform[2]);
        }}
        proOptions={{ hideAttribution: true }}
        aria-label="Canvas de arquitetura"
        minZoom={0.08}
        maxZoom={1.75}
      >
        {!sequenceMode && (
          <>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
            <Controls className="!overflow-hidden !rounded-lg !border !border-white/10 !bg-[#121821] !shadow-none" />
            <MiniMap
              className="!overflow-hidden !rounded-lg !border !border-white/10 !bg-[#0d1219]"
              maskColor="rgba(2,6,23,0.75)"
              nodeColor={(node) =>
                node.type === "zone" ? "#312e81" : node.type === "block" ? "#334155" : "#475569"
              }
            />
            {/* Title Block */}
            <div className="absolute bottom-4 left-4 z-30 pointer-events-none">
              <TitleBlock
                title={name || "Arquitetura"}
                author="Arquiteto"
                version="1.0"
                nfr={nfr}
                variant="overlay"
              />
            </div>
            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
              <DiagramLegend variant="overlay" />
            </div>
          </>
        )}
      </ReactFlow>
      {!sequenceMode && (
        <>
          <CanvasComments />
          <LineageView />
          <BlastRadiusOverlay />
        </>
      )}
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
