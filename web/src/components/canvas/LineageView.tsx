"use client";

import { useEffect, useState } from "react";
import { GitBranch, X } from "lucide-react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import PanelEmpty from "@/components/ui/PanelEmpty";

/**
 * P1.1.7 — Visual lineage graph rendered as an overlay on the canvas.
 * Shows data-pipeline flow: source entity → transform → target entity.
 */
export default function LineageView() {
  const graphId = useGraphStore((s) => s.graphId);
  const [dismissed, setDismissed] = useState(false);
  const [data, setData] = useState<{
    lineage_edges: Array<{
      source_label: string;
      target_label: string;
      transform?: string;
      origin?: string;
    }>;
    entities: string[];
    edge_count: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(graphId) && !dismissed;

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.lineage(graphId);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDismissed(true)}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 elev-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">Lineage visual</p>
            <p className="text-xs text-[var(--muted)]">Fluxos de dados detectados no diagrama</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-[var(--border-strong)] bg-black/40 px-2 py-1 text-xs text-slate-300 hover:border-[var(--accent)]/40"
            onClick={() => setDismissed(true)}
          >
            <X size={14} />
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : data?.lineage_edges.length === 0 ? (
          <div className="mt-4">
            <PanelEmpty
              icon={GitBranch}
              title="Nenhum fluxo de dados"
              description="Adicione arestas com flowKind=data ou preencha o lineage no Contexto."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {data?.lineage_edges.map((edge, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-xs"
              >
                <span className="min-w-[120px] truncate text-indigo-200">{edge.source_label}</span>
                <span className="text-[var(--muted)]">→</span>
                {edge.transform && (
                  <span className="rounded bg-violet-500/20 px-2 py-0.5 text-sm text-violet-200">
                    {edge.transform}
                  </span>
                )}
                <span className="text-[var(--muted)]">→</span>
                <span className="min-w-[120px] truncate text-emerald-200">{edge.target_label}</span>
                {edge.origin === "nfr" && (
                  <span className="ml-auto text-sm text-[var(--muted-fg)]">NFR</span>
                )}
              </div>
            ))}
            {data?.entities.length ? (
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/20 p-2">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted-fg)]">
                  Entidades
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.entities.map((e) => (
                    <span
                      key={e}
                      className="rounded-full border border-[var(--border-strong)] bg-white/5 px-2 py-0.5 text-sm text-[var(--muted-fg)]"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
