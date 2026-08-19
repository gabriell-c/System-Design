"use client";

import { Link2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Link2 size={12} className="text-violet-400" />
        Contratos de borda
      </div>
      <p className="text-[10px] text-slate-500">
        Defina como os subsystems se comunicam nas fronteiras.
      </p>

      <div className="space-y-2">
        {contracts.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-300">{c.source_zone}</span>
              <span className="text-slate-500">→</span>
              <span className="text-[10px] font-mono text-violet-300">{c.target_zone}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                c.protocol === "sync" ? "bg-emerald-500/20 text-emerald-200" :
                c.protocol === "data" ? "bg-amber-500/20 text-amber-200" :
                "bg-slate-500/20 text-slate-300"
              }`}>
                {c.protocol}
              </span>
              {c.sla_ms && (
                <span className="text-[9px] text-slate-500">SLA: {c.sla_ms}ms</span>
              )}
            </div>
            <button
              type="button"
              className="text-slate-500 hover:text-rose-400"
              onClick={() => handleDelete(c.id)}
              title="Remover contrato"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {contracts.length === 0 && (
          <p className="text-[10px] text-slate-600">Nenhum contrato configurado.</p>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="Subsistema origem"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <input
            className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="Subsistema destino"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-200"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as "sync" | "async" | "data")}
          >
            <option value="async">Async</option>
            <option value="sync">Sync</option>
            <option value="data">Data</option>
          </select>
          <input
            className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="SLA (ms)"
            value={slaMs}
            onChange={(e) => setSlaMs(e.target.value)}
          />
          <input
            className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="w-full rounded-md bg-violet-600/80 px-3 py-1.5 text-[11px] text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={handleAdd}
          disabled={loading || !source.trim() || !target.trim()}
        >
          Adicionar contrato
        </button>
      </div>
    </div>
  );
}
