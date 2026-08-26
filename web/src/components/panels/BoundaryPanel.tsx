"use client";

import { Link2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PanelEmpty from "@/components/ui/PanelEmpty";

interface Props {
  graphId: string;
}

export default function BoundaryPanel({ graphId }: Props) {
  const [contracts, setContracts] = useState<Array<{ id: string; source_zone: string; target_zone: string; protocol: string; description: string; sla_ms?: number }>>([]);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [protocol, setProtocol] = useState<"sync" | "async" | "data">("async");
  const [description, setDescription] = useState("");
  const [slaMs, setSlaMs] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api.listBoundaryContracts(graphId).then(setContracts).catch(() => undefined);
  }, [graphId]);

  const handleAdd = async () => {
    if (!source.trim() || !target.trim()) return;
    setLoading(true);
    try {
      await api.createBoundaryContract(graphId, {
        source_zone: source.trim(),
        target_zone: target.trim(),
        protocol,
        description: description.trim(),
        sla_ms: slaMs ? Number(slaMs) : undefined,
      });
      const updated = await api.listBoundaryContracts(graphId);
      setContracts(updated);
      setSource("");
      setTarget("");
      setDescription("");
      setSlaMs("");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    await api.deleteBoundaryContract(graphId, contractId);
    setContracts((prev) => prev.filter((c) => c.id !== contractId));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        <Link2 size={12} className="text-violet-400" />
        Contratos de borda
      </div>
      <p className="text-sm text-[var(--muted)]">
        Defina como os subsystems se comunicam nas fronteiras.
      </p>

      <div className="space-y-2">
        {contracts.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-indigo-300">{c.source_zone}</span>
              <span className="text-[var(--muted)]">→</span>
              <span className="text-sm font-mono text-violet-300">{c.target_zone}</span>
              <span className={`rounded px-2 py-0.5 text-sm font-semibold ${
                c.protocol === "sync" ? "bg-emerald-500/20 text-emerald-200" :
                c.protocol === "data" ? "bg-amber-500/20 text-amber-200" :
                "bg-slate-500/20 text-slate-300"
              }`}>
                {c.protocol}
              </span>
              {c.sla_ms && (
                <span className="text-sm text-[var(--muted)]">SLA: {c.sla_ms}ms</span>
              )}
            </div>
            <button
              type="button"
              className="text-[var(--muted)] hover:text-rose-400"
              onClick={() => handleDelete(c.id)}
              title="Remover contrato"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {contracts.length === 0 && (
          <PanelEmpty
            icon={Link2}
            title="Nenhum contrato"
            description="Defina contratos entre zonas (sync, async ou data)."
          />
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
            placeholder="Subsistema origem"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <input
            className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
            placeholder="Subsistema destino"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-200"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as "sync" | "async" | "data")}
          >
            <option value="async">Async</option>
            <option value="sync">Sync</option>
            <option value="data">Data</option>
          </select>
          <input
            className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
            placeholder="SLA (ms)"
            value={slaMs}
            onChange={(e) => setSlaMs(e.target.value)}
          />
          <input
            className="rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="w-full rounded-md bg-violet-600/80 px-3 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={handleAdd}
          disabled={loading || !source.trim() || !target.trim()}
        >
          Adicionar contrato
        </button>
      </div>
    </div>
  );
}
