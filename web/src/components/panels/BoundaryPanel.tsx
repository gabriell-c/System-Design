"use client";

import { AlertTriangle, Link2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import PanelEmpty from "@/components/ui/PanelEmpty";
import { useGraphStore } from "@/lib/graph-store";

interface Props {
  graphId: string;
}

type Protocol = "sync" | "async" | "data";

interface BoundaryContract {
  id: string;
  source_zone: string;
  target_zone: string;
  protocol: string;
  description: string;
  sla_ms?: number;
}

/** R9: rótulo pt-BR; o VALOR no wire segue crú (`sync`/`async`/`data`). */
const PROTOCOL_LABELS: Record<Protocol, string> = {
  sync: "Síncrono",
  async: "Assíncrono",
  data: "Dados",
};

function protocolLabel(protocol: string): string {
  return PROTOCOL_LABELS[protocol as Protocol] ?? protocol;
}

const INPUT_CLASS =
  "rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]";
const LABEL_CLASS = "text-xs font-medium uppercase tracking-wide text-[var(--muted)]";

/**
 * R9 — contratos de borda entre sub-sistemas. Correções:
 * - load com AbortController + estado `error` (banner + retry) +
 *   `loading` (esqueleto) — vazio só com `!loading && !error && lista vazia`;
 * - `<datalist>` com os labels das zones do canvas (entrada livre mantém);
 * - `<label>` nos inputs (a11y); protocolo com rótulo pt-BR (valor crú no
 *   wire); "subsystems" → "sub-sistemas"; handleAdd/handleDelete com erro
 *   em toast (antes engolido em `finally`).
 */
export default function BoundaryPanel({ graphId }: Props) {
  const [contracts, setContracts] = useState<BoundaryContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("async");
  const [description, setDescription] = useState("");
  const [slaMs, setSlaMs] = useState("");
  const [tick, setTick] = useState(0);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const nodes = useGraphStore((s) => s.nodes);

  // Sugestões do datalist: labels das zones do canvas (entrada livre
  // segue permitida — o datalist só sugere).
  const zoneSuggestions = useMemo(
    () => nodes.filter((n) => n.data.kind === "zone").map((n) => n.data.label),
    [nodes],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .listBoundaryContracts(graphId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setContracts(result);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [graphId, tick]);

  const handleAdd = async () => {
    if (!source.trim() || !target.trim()) return;
    setSaving(true);
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
      pushUiNotice({ type: "success", text: "Contrato de borda adicionado." });
    } catch (e) {
      pushUiNotice({ type: "error", text: `Falha ao adicionar contrato: ${e instanceof Error ? e.message : "erro desconhecido"}.` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    try {
      await api.deleteBoundaryContract(graphId, contractId);
      setContracts((prev) => prev.filter((c) => c.id !== contractId));
    } catch (e) {
      // Antes: engolido — sem o catch, um DELETE falho virava crash silencioso.
      pushUiNotice({ type: "error", text: `Falha ao remover contrato: ${e instanceof Error ? e.message : "erro desconhecido"}.` });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        <Link2 size={12} className="text-violet-400" />
        Contratos de borda
      </div>
      <p className="text-sm text-[var(--muted)]">
        Defina como os sub-sistemas se comunicam nas fronteiras.
      </p>

      {error && !loading && (
        <div className="space-y-2">
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300"
          >
            <AlertTriangle size={14} />
            Falha ao carregar: {error}
          </p>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5"
            onClick={() => setTick((t) => t + 1)}
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-label="Carregando contratos de borda">
          <div className="h-12 animate-pulse rounded-lg border border-[var(--border)] bg-white/5" />
          <div className="h-12 animate-pulse rounded-lg border border-[var(--border)] bg-white/5" />
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-indigo-300">{c.source_zone}</span>
                <span className="text-[var(--muted)]">→</span>
                <span className="text-sm font-mono text-violet-300">{c.target_zone}</span>
                <span
                  className={`rounded px-2 py-0.5 text-sm font-semibold ${
                    c.protocol === "sync"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : c.protocol === "data"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-slate-500/20 text-slate-300"
                  }`}
                >
                  {protocolLabel(c.protocol)}
                </span>
                {c.sla_ms && <span className="text-sm text-[var(--muted)]">SLA: {c.sla_ms}ms</span>}
              </div>
              <button
                type="button"
                className="text-[var(--muted)] hover:text-rose-400"
                onClick={() => void handleDelete(c.id)}
                title="Remover contrato"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {/* Vazio honesto: só sem loading/erro (fim do empty enganoso durante fetch). */}
          {contracts.length === 0 && (
            <PanelEmpty
              icon={Link2}
              title="Nenhum contrato"
              description="Defina contratos entre zonas (síncrono, assíncrono ou dados)."
            />
          )}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-black/20 p-3">
        {/* Sugestões: labels das zones do canvas; entrada livre segue permitida. */}
        <datalist id="boundary-zone-suggestions">
          {zoneSuggestions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="boundary-source">
              Sub-sistema origem
            </label>
            <input
              id="boundary-source"
              list="boundary-zone-suggestions"
              className={`mt-1 w-full ${INPUT_CLASS}`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="boundary-target">
              Sub-sistema destino
            </label>
            <input
              id="boundary-target"
              list="boundary-zone-suggestions"
              className={`mt-1 w-full ${INPUT_CLASS}`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="boundary-protocol">
              Protocolo
            </label>
            <select
              id="boundary-protocol"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-200"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as Protocol)}
            >
              <option value="sync">Síncrono</option>
              <option value="async">Assíncrono</option>
              <option value="data">Dados</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="boundary-sla">
              SLA (ms)
            </label>
            <input
              id="boundary-sla"
              inputMode="numeric"
              className={`mt-1 w-full ${INPUT_CLASS}`}
              value={slaMs}
              onChange={(e) => setSlaMs(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="boundary-description">
              Descrição
            </label>
            <input
              id="boundary-description"
              className={`mt-1 w-full ${INPUT_CLASS}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="w-full rounded-md bg-violet-600/80 px-3 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={() => void handleAdd()}
          disabled={saving || !source.trim() || !target.trim()}
        >
          {saving ? "Adicionando…" : "Adicionar contrato"}
        </button>
      </div>
    </div>
  );
}
