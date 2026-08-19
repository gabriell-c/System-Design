"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";

export default function PolyglotMapPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.polyglotMap>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!graphId) return;
    void api
      .polyglotMap(graphId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [graphId]);

  if (!graphId) {
    return <p className="px-4 py-4 text-sm text-slate-400">Salve o diagrama para ver o polyglot map.</p>;
  }
  if (error) return <p className="px-4 py-4 text-sm text-rose-300">{error}</p>;
  if (!data) return <p className="px-4 py-4 text-sm text-slate-400">Carregando matriz…</p>;

  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-sm font-semibold text-slate-100">Polyglot Map</p>
      <p className="text-xs text-slate-400">
        {data.summary.database_count} DB(s) · {data.summary.shared_db_count} compartilhado(s)
      </p>
      <ul className="space-y-2">
        {data.services.map((s) => (
          <li key={s.service} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
            <p className="font-medium text-slate-100">{s.service}</p>
            {s.databases.map((db) => (
              <p key={db.database_id} className="text-slate-400">
                → {db.database_label} ({db.engine})
                {db.pii_sensitivity !== "none" ? ` · PII ${db.pii_sensitivity}` : ""}
              </p>
            ))}
            {s.polyglot && <span className="text-violet-300">polyglot</span>}
          </li>
        ))}
      </ul>
      {(data.shared_databases?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
          <p className="font-semibold">Shared databases</p>
          {data.shared_databases.map((s) => (
            <p key={s.database_id}>
              {s.database_label}: {s.services.join(", ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
