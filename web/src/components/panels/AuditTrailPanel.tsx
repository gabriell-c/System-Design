"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";

type AuditEntryRow = {
  id: string;
  action?: string;
  user_email?: string;
  entity_type?: string;
  entity_id?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export default function AuditTrailPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const [entries, setEntries] = useState<AuditEntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.listAuditEntries(graphId, { limit, offset: page * limit });
        if (cancelled) return;
        setEntries(data.entries as AuditEntryRow[]);
        setTotal(data.total);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId, page]);

  if (!graphId) {
    return (
      <p className="px-4 py-4 text-sm text-slate-400">Salve o diagrama para ver o histórico de auditoria.</p>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
          <History size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Audit Trail</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Registro de todas as alterações (P1.4.4).
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Carregando...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && entries.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma entrada de auditoria encontrada.</p>
      )}

      {!loading && entries.length > 0 && (
        <>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{entry.action}</span>
                  <span className="text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-slate-400">
                  <span className="text-slate-500">Por: </span>
                  {entry.user_email}
                </p>
                <p className="mt-1 text-slate-400">
                  <span className="text-slate-500">Entidade: </span>
                  {entry.entity_type} {entry.entity_id && `#${entry.entity_id.slice(0, 8)}`}
                </p>
                {entry.ip_address != null && entry.ip_address !== "" && (
                  <p className="mt-1 text-slate-500">IP: {String(entry.ip_address)}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{total} entradas totais</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={page * limit + entries.length >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Próximo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
