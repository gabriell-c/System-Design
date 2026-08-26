"use client";

import { Activity, Gauge } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import PanelEmpty from "@/components/ui/PanelEmpty";

type SloCard = {
  node_id: string;
  label: string;
  slo_availability_pct: number;
  slo_latency_p99_ms: number;
  error_budget_remaining_pct: number;
};

/** P0.5 — SLI/SLO e error budget por serviço. */
export default function SloPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const [services, setServices] = useState<SloCard[]>([]);
  const [budget, setBudget] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!graphId) return;
      try {
        const res = await api.graphSlo(graphId);
        if (cancelled) return;
        setServices((res.services as SloCard[]) ?? []);
        setBudget(res.error_budget as Record<string, unknown>);
      } catch {
        if (!cancelled) {
          setServices([]);
          setBudget(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Gauge size={16} className="text-indigo-300" />
          Error budget
        </p>
        {budget ? (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-[var(--border)] bg-black/20 px-2 py-2">
              <dt className="text-[var(--muted)]">SLO avail.</dt>
              <dd className="font-mono text-slate-200">{String(budget.slo_availability_pct)}%</dd>
            </div>
            <div className="rounded border border-[var(--border)] bg-black/20 px-2 py-2">
              <dt className="text-[var(--muted)]">Status</dt>
              <dd className="capitalize text-slate-200">{String(budget.status)}</dd>
            </div>
            <div className="col-span-2 rounded border border-[var(--border)] bg-black/20 px-2 py-2">
              <dt className="text-[var(--muted)]">Downtime/mês permitido (min)</dt>
              <dd className="font-mono text-slate-200">{String(budget.allowed_downtime_min_per_month)}</dd>
            </div>
          </dl>
        ) : (
          <PanelEmpty
            icon={Gauge}
            title="SLO ainda não calculado"
            description="Salve o grafo para calcular disponibilidade e error budget."
          />
        )}
      </div>

      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Activity size={16} className="text-emerald-300" />
          SLI/SLO por serviço
        </p>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {services.map((s) => (
            <li key={s.node_id} className="rounded border border-[var(--border)] px-2 py-2 text-xs">
              <p className="font-medium text-slate-200">{s.label}</p>
              <p className="text-[var(--muted)]">
                {s.slo_availability_pct}% · p99 {s.slo_latency_p99_ms}ms · budget {s.error_budget_remaining_pct}%
              </p>
            </li>
          ))}
        </ul>
        {services.length === 0 && (
          <PanelEmpty
            icon={Activity}
            title="Nenhum serviço no canvas"
            description="Adicione componentes no diagrama para ver SLOs e error budget."
          />
        )}
      </div>
    </div>
  );
}
