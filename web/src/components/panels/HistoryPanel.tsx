"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { CanvasNodeData, GraphVersion } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";
import PanelEmpty from "@/components/ui/PanelEmpty";
import { History } from "lucide-react";

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
    return (
      <PanelEmpty
        icon={History}
        title="Salve a arquitetura"
        description="O histórico de versões aparece após o primeiro save."
      />
    );
  }

  return (
    <div className="space-y-2 px-4 py-4">
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {versions.length === 0 && (
        <PanelEmpty
          icon={History}
          title="Nenhuma versão ainda"
          description="Cada save cria um snapshot restaurável."
        />
      )}
      <ul className="space-y-2">
        {versions.map((version) => (
          <li key={version.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3">
            <p className="text-sm text-slate-200">{version.name}</p>
            <p className="text-xs text-[var(--muted)]">{new Date(version.created_at).toLocaleString("pt-BR")}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
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
                className="rounded-md bg-[var(--accent-muted)] px-2 py-1 text-xs font-medium text-indigo-200 hover:bg-[var(--accent)]/30"
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
