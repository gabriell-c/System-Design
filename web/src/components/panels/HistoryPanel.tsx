"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { CanvasNodeData, GraphVersion } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

export default function HistoryPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const loadSnapshot = useGraphStore((s) => s.loadSnapshot);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const [versions, setVersions] = useState<GraphVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    api
      .listVersions(graphId)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao listar versões");
      });
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  if (!graphId) {
    return <p className="px-4 py-4 text-sm text-slate-400">Salve a arquitetura para gravar histórico.</p>;
  }

  return (
    <div className="space-y-2 px-4 py-4">
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {versions.length === 0 && <p className="text-sm text-slate-400">Nenhuma versão ainda.</p>}
      <ul className="space-y-2">
        {versions.map((version) => (
          <li key={version.id} className="rounded-lg border border-white/10 bg-[#0d1219] p-3">
            <p className="text-sm text-slate-200">{version.name}</p>
            <p className="text-xs text-slate-500">{new Date(version.created_at).toLocaleString("pt-BR")}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
                onClick={() =>
                  loadSnapshot(
                    version.name,
                    version.nodes as Node<CanvasNodeData>[],
                    version.edges as Edge[],
                  )
                }
              >
                Pré-visualizar
              </button>
              <button
                type="button"
                className="rounded-md bg-cyan-500/20 px-2 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30"
                onClick={async () => {
                  const restored = await api.restoreVersion(graphId, version.id);
                  loadGraph(restored);
                }}
              >
                Restaurar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
