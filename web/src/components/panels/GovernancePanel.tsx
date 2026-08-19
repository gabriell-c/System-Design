"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import { useProjectStore } from "@/lib/project-store";

type RaciRow = {
  component: string;
  accountable: string;
  responsible: string;
  consulted: string;
  informed: string;
};

type PolicyFinding = {
  policy_id: string;
  severity: string;
  title: string;
  detail: string;
  graph_name?: string;
};

/** P0.4 — Governança: RACI + policy as code. */
export default function GovernancePanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const graphId = useGraphStore((s) => s.graphId);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const [raci, setRaci] = useState<{ rows: RaciRow[] } | null>(null);
  const [policies, setPolicies] = useState<PolicyFinding[]>([]);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const [r, p] = await Promise.all([
        api.projectRaci(activeProjectId),
        api.projectPolicy(activeProjectId),
      ]);
      setRaci(r as { rows: RaciRow[] });
      setPolicies((p as { findings?: PolicyFinding[] }).findings ?? []);
    } catch {
      setRaci(null);
      setPolicies([]);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void load();
  }, [load, graphId]);

  async function exportAdrs() {
    if (!activeProjectId) return;
    const nodes = useGraphStore.getState().nodes;
    const nfr = useGraphStore.getState().nfr;
    const context = useGraphStore.getState().context;
    const { buildAdrs } = await import("@/lib/adr");
    const adrs = buildAdrs(nodes, nfr, context);
    try {
      const res = await api.exportProjectAdrs(activeProjectId, adrs);
      pushUiNotice({ type: "success", text: `${res.count} ADR(s) gravados em docs/adr/.` });
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha ao exportar ADRs",
      });
    }
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Users size={16} className="text-violet-300" />
          Matriz RACI
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[480px] text-[10px]">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">Componente</th>
                <th className="px-2 py-1">A</th>
                <th className="px-2 py-1">R</th>
                <th className="px-2 py-1">C</th>
                <th className="px-2 py-1">I</th>
              </tr>
            </thead>
            <tbody>
              {(raci?.rows ?? []).slice(0, 12).map((row) => (
                <tr key={row.component} className="border-t border-white/5 text-slate-300">
                  <td className="px-2 py-1">{row.component}</td>
                  <td className="px-2 py-1 text-center">{row.accountable}</td>
                  <td className="px-2 py-1 text-center">{row.responsible}</td>
                  <td className="px-2 py-1 text-center">{row.consulted}</td>
                  <td className="px-2 py-1 text-center">{row.informed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Shield size={16} className="text-rose-300" />
          Policy as code
        </p>
        {policies.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-400">Nenhuma violação de política detectada.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {policies.map((f, i) => (
              <li key={`${f.policy_id}-${i}`} className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-100">
                <span className="font-mono text-[10px] text-rose-300">{f.policy_id}</span> · {f.title}
                <p className="text-slate-400">{f.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="btn-primary w-full text-xs" onClick={() => void exportAdrs()}>
        Persistir ADRs em Markdown
      </button>
    </div>
  );
}
