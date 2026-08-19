"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";

export default function LineagePanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.lineage>> | null>(null);

  useEffect(() => {
    if (!graphId) return;
    void api.lineage(graphId).then(setData).catch(() => setData(null));
  }, [graphId]);

  if (!graphId) {
    return <p className="px-4 py-4 text-sm text-slate-400">Salve o diagrama para ver lineage.</p>;
  }
  if (!data) return <p className="px-4 py-4 text-sm text-slate-400">Carregando lineage…</p>;

  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-sm font-semibold text-slate-100">Lineage visual</p>
      <p className="text-xs text-slate-400">{data.edge_count} fluxo(s) de dados</p>
      <ul className="space-y-2">
        {data.lineage_edges.map((e, i) => (
          <li key={`${e.source_label}-${e.target_label}-${i}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
            <span className="text-cyan-200">{e.source_label}</span>
            <span className="text-slate-500"> → </span>
            <span className="text-emerald-200">{e.target_label}</span>
            {e.transform && <p className="mt-1 text-slate-500">{e.transform}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
