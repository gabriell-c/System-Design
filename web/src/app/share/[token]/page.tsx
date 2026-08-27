"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type SharedPayload = {
  id: string;
  name: string;
  context: string;
  nodes: unknown[];
  edges: unknown[];
  read_only: boolean;
};

/** Read-only shared diagram view (T13). */
export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [data, setData] = useState<SharedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void api
      .getSharedGraph(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar"));
  }, [token]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-rose-300" role="alert">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-[var(--muted)]">
        Carregando diagrama compartilhado…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[70vh] flex-col bg-[var(--canvas-bg)]" data-testid="share-readonly">
      <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
        <h1 className="text-sm font-semibold text-[var(--foreground)]">{data.name}</h1>
        <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-xs text-amber-100">
          Somente leitura
        </span>
      </header>
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={(data.nodes as never[]) ?? []}
          edges={(data.edges as never[]) ?? []}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
