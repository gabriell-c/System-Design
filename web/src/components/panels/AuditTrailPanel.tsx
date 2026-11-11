"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { api } from "@/lib/api";
import { useApiEffect } from "@/hooks/useApiEffect";
import { useGraphStore } from "@/lib/graph-store";
import PanelEmpty from "@/components/ui/PanelEmpty";
import PanelHeader from "@/components/ui/PanelHeader";
import Skeleton from "@/components/ui/Skeleton";

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

  useApiEffect(
    async (isCancelled) => {
      if (!graphId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.listAuditEntries(graphId, { limit, offset: page * limit });
        if (isCancelled()) return;
        setEntries(data.entries as AuditEntryRow[]);
        setTotal(data.total);
      } catch (e) {
        if (!isCancelled()) setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [graphId, page],
  );

  if (!graphId) {
    return (
      <p className="px-4 py-4 text-sm text-[var(--muted-fg)]">Salve o diagrama para ver o histórico de auditoria.</p>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={History}
        chipClass="bg-blue-500/15 text-blue-300"
        title="Audit Trail"
        subtitle="Registro de todas as alterações (P1.4.4)."
      />

      {loading && <Skeleton rows={4} className="px-1" />}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && entries.length === 0 && (
        <PanelEmpty
          icon={History}
          title="Nenhuma entrada de auditoria"
          description="Ações de save, análise e mudanças de acesso aparecerão aqui."
        />
      )}

      {!loading && entries.length > 0 && (
        <>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{entry.action}</span>
                  <span className="text-[var(--muted)]">{entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}</span>
                </div>
                <p className="mt-1 text-[var(--muted-fg)]">
                  <span className="text-[var(--muted)]">Por: </span>
                  {entry.user_email}
                </p>
                <p className="mt-1 text-[var(--muted-fg)]">
                  <span className="text-[var(--muted)]">Entidade: </span>
                  {entry.entity_type} {entry.entity_id && `#${entry.entity_id.slice(0, 8)}`}
                </p>
                {entry.ip_address != null && entry.ip_address !== "" && (
                  <p className="mt-1 text-[var(--muted)]">IP: {String(entry.ip_address)}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--muted)]">{total} entradas totais</p>
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
