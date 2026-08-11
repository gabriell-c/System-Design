"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Boxes, Keyboard, MousePointerClick, Share2, Unlink2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArchNode from "@/components/nodes/ArchNode";
import BlockNode from "@/components/nodes/BlockNode";
import { findBlockAtPoint, isBlockNode } from "@/lib/blocks";
import { KIND_META } from "@/lib/catalog";
import { useGraphStore } from "@/lib/graph-store";
import { computeSnap, type GuideLine } from "@/lib/snap";
import type { CanvasNodeData, NodeKind } from "@/lib/types";

const nodeTypes: NodeTypes = {
  arch: ArchNode,
  block: BlockNode,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function CanvasInner() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const addCatalogNode = useGraphStore((s) => s.addCatalogNode);
  const addBlock = useGraphStore((s) => s.addBlock);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const resolveNestingAfterDrag = useGraphStore((s) => s.resolveNestingAfterDrag);
  const checkpointDrag = useGraphStore((s) => s.checkpointDrag);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const disconnectEdge = useGraphStore((s) => s.disconnectEdge);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const reconcileOrphanCards = useGraphStore((s) => s.reconcileOrphanCards);
  const { screenToFlowPosition, setNodes } = useReactFlow();
  const [hintsOpen, setHintsOpen] = useState(false);
  const [guidelines, setGuidelines] = useState<GuideLine[]>([]);
  const snapRef = useRef({ active: false, originalPositions: new Map<string, { x: number; y: number }>() });

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
    const blocks = nodes.filter((n) => isBlockNode(n));
    const rest = nodes.filter((n) => !isBlockNode(n));
    return [...blocks, ...rest];
  }, [nodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const blockDomain = event.dataTransfer.getData("application/system-design-block") as NodeKind | "";
      if (blockDomain) {
        addBlock(blockDomain, { x: position.x - 160, y: position.y - 40 });
        return;
      }

      const catalogId = event.dataTransfer.getData("application/system-design");
      if (!catalogId) return;

      const block = findBlockAtPoint(nodes, position);
      if (block) {
        const abs = {
          x: block.position.x,
          y: block.position.y,
        };
        addCatalogNode(
          catalogId,
          {
            x: Math.max(16, position.x - abs.x - 100),
            y: Math.max(56, position.y - abs.y - 30),
          },
          block.id,
        );
        return;
      }

      addCatalogNode(catalogId, { x: position.x - 100, y: position.y - 30 });
    },
    [addBlock, addCatalogNode, nodes, screenToFlowPosition],
  );

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
                  <strong className="text-slate-100">1. Bloco</strong> — área do domínio (Frontend, Backend…).
                </span>
              </li>
              <li className="flex gap-3">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>
                  <strong className="text-slate-100">2. Cards</strong> — tecnologias do mesmo domínio dentro do bloco.
                </span>
              </li>
              <li className="flex gap-3">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>
                  <strong className="text-slate-100">3. Ligações</strong> — arraste entre os pontos. Duplo clique remove.
                </span>
              </li>
            </ol>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["frontend", "backend", "database", "cloud"] as NodeKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="btn-ghost flex items-center justify-center gap-1.5 py-2"
                  onClick={() => startWith(kind)}
                >
                  {KIND_META[kind].label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-500">
              Ou abra <strong className="text-slate-400">Contexto</strong> e escolha um template (MVP, SaaS, Marketplace…).
            </p>
          </div>
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
              <li>Card só entra em bloco do mesmo domínio</li>
              <li>Itens alinham automaticamente ao arrastar</li>
            </ul>
          )}
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
        nodes={orderedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onSelectionChange={({ nodes: selected }) => {
          setSelectedNodeId(selected[0]?.id ?? null);
        }}
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
          const allNodes = useGraphStore.getState().nodes;
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
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
        proOptions={{ hideAttribution: true }}
        aria-label="Canvas de arquitetura"
        minZoom={0.25}
        maxZoom={1.75}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls className="!overflow-hidden !rounded-lg !border !border-white/10 !bg-[#121821] !shadow-none" />
        <MiniMap
          className="!overflow-hidden !rounded-lg !border !border-white/10 !bg-[#0d1219]"
          maskColor="rgba(2,6,23,0.75)"
          nodeColor={(node) => (node.type === "block" ? "#334155" : "#475569")}
        />
      </ReactFlow>
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
