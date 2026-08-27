"use client";

import { useMemo, useCallback } from "react";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";
import { isFreeData, type CanvasNodeData } from "@/lib/types";
import { freeLayerOrder } from "@/lib/free-layer";

export default function LayerHierarchyPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const moveFreeNodeLayer = useGraphStore((s) => s.moveFreeNodeLayer);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

  // Filtra apenas nós free e ordena por layerOrder
  const freeNodes = useMemo(
    () =>
      nodes
        .filter((n) => n.type === "free" && isFreeData(n.data))
        .sort((a, b) => {
          const aOrder = isFreeData(a.data) ? freeLayerOrder(a.data, a.id) : 0;
          const bOrder = isFreeData(b.data) ? freeLayerOrder(b.data, b.id) : 0;
          return aOrder - bOrder;
        }),
    [nodes],
  );

  const moveUp = useCallback(
    (nodeId: string) => {
      moveFreeNodeLayer(nodeId, "front");
    },
    [moveFreeNodeLayer],
  );

  const moveDown = useCallback(
    (nodeId: string) => {
      moveFreeNodeLayer(nodeId, "back");
    },
    [moveFreeNodeLayer],
  );

  if (freeNodes.length === 0) {
    return (
      <div className="p-4 text-center">
        <Layers className="mx-auto h-8 w-8 text-[var(--muted)] mb-2" />
        <p className="text-sm text-[var(--muted-fg)]">
          Nenhum nó livre no canvas.
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">
          Adicione formas na paleta lateral.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-[var(--muted)]">
          Hierarquia Visual
        </h3>
        <span className="text-xs text-[var(--muted-fg)]">
          {freeNodes.length} nós
        </span>
      </div>

      <div className="space-y-1">
        {freeNodes.map((node, index) => {
          const data = node.data as CanvasNodeData;
          const isFree = isFreeData(data);
          if (!isFree) return null;

          const layerOrder = freeLayerOrder(data, node.id);
          const isSelected = selectedNodeId === node.id;

          return (
            <div
              key={node.id}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                  : "border-[var(--border)] bg-[var(--surface-2)]"
              }`}
            >
              <span className="text-[10px] font-mono text-[var(--muted-fg)] w-6 text-right">
                {index + 1}
              </span>
              <Layers className="h-3 w-3 text-[var(--muted)] shrink-0" />
              <span className="flex-1 truncate text-xs text-[var(--foreground)]">
                {data.label}
              </span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => moveUp(node.id)}
                  disabled={index === 0}
                  className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Mover para frente"
                  aria-label="Mover para frente"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(node.id)}
                  disabled={index === freeNodes.length - 1}
                  className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Mover para trás"
                  aria-label="Mover para trás"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2">
        <p className="text-[10px] text-[var(--muted-fg)]">
          <strong>Legenda:</strong> Posição <strong>1</strong> = mais atrás, posição <strong>N</strong> = mais na frente.
          Setas ↑↓ movem o nó para frente/trás na pilha visual.
        </p>
      </div>
    </div>
  );
}
