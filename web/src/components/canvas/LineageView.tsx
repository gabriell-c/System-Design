"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";

/**
 * P1.1.7 — Visual lineage graph rendered as an overlay on the canvas.
 * Shows data-pipeline flow: source entity → transform → target entity.
 */
export default function LineageView() {
  const graphId = useGraphStore((s) => s.graphId);
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (!graphId) return;
    setOpen(true);
    void api.lineage(graphId).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [graphId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#0d1219] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">Lineage visual</p>
            <p className="text-xs text-slate-500">Fluxos de dados detectados no diagrama</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-slate-300 hover:border-cyan-400/40"
            onClick={() => setOpen(false)}
          >
            <X size={14} />
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : data?.lineage_edges.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhum fluxo de dados detectado. Adicione arestas com flowKind=data ou preencha o lineage no Contexto.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data?.lineage_edges.map((edge, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
              >
                <span className="min-w-[120px] truncate text-cyan-200">{edge.source_label}</span>
                <span className="text-slate-500">→</span>
                {edge.transform && (
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-200">
                    {edge.transform}
                  </span>
                )}
                <span className="text-slate-500">→</span>
                <span className="min-w-[120px] truncate text-emerald-200">{edge.target_label}</span>
                {edge.origin === "nfr" && (
                  <span className="ml-auto text-[10px] text-slate-600">NFR</span>
                )}
              </div>
            ))}
            {data?.entities.length ? (
              <div className="mt-3 rounded-lg border border-white/8 bg-black/20 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Entidades
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.entities.map((e) => (
                    <span
                      key={e}
                      className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
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
