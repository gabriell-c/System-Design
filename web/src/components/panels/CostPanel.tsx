"use client";

import { DollarSign, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { CostBreakdown } from "@/lib/types";

export default function CostPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.costEstimate(graphId);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  if (!graphId) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">Salve o diagrama para ver custos.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-[var(--muted-fg)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando custos…
      </div>
    );
  }

  if (error) {
    return <p className="px-4 py-6 text-sm text-rose-400">{error}</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
          <DollarSign size={16} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Cost model</p>
          <p className="mt-0.5 text-xs text-[var(--muted-fg)]">{data.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-emerald-300">${data.total_usd_month}</p>
          <p className="text-sm uppercase text-[var(--muted)]">Total / mês</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-slate-300">{data.node_count}</p>
          <p className="text-sm uppercase text-[var(--muted)]">Serviços</p>
        </div>
      </div>

      {Object.keys(data.by_region).length > 0 && (
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Por região</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-300">
            {Object.entries(data.by_region).map(([region, usd]) => (
              <li key={region} className="flex justify-between">
                <span>{region}</span>
                <span className="tabular-nums text-emerald-300">${usd}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Por serviço</p>
        <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs custom-scroll">
          {data.line_items.map((item) => (
            <li key={item.node_id} className="flex justify-between gap-2 rounded border border-[var(--border)] px-2 py-1">
              <span className="truncate text-slate-300">{item.label}</span>
              <span className="shrink-0 tabular-nums text-emerald-300">${item.cost_usd_month}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
