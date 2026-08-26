"use client";

import { AlertTriangle, Loader2, Skull, Zap } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import { isArchData } from "@/lib/types";
import type { BlastRadiusResult, FailureInjectionResult } from "@/lib/types";

export default function ResiliencePanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setBlastRadiusHighlight = useGraphStore((s) => s.setBlastRadiusHighlight);
  const clearBlastRadiusHighlight = useGraphStore((s) => s.clearBlastRadiusHighlight);

  const [mode, setMode] = useState<"down" | "timeout" | "degraded">("down");
  const [loading, setLoading] = useState(false);
  const [injection, setInjection] = useState<FailureInjectionResult | null>(null);
  const [blast, setBlast] = useState<BlastRadiusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceNodes = nodes.filter((n) => isArchData(n.data));

  async function runInjection() {
    if (!graphId || !selectedNodeId) {
      setError("Selecione um nó no canvas.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.failureInjection(graphId, {
        node_id: selectedNodeId,
        mode,
        max_hops: 8,
      });
      setInjection(result);
      if (!result.ok) {
        setError(result.error ?? "Falha na injeção");
        return;
      }
      const blastResult = await api.blastRadius(graphId, {
        node_id: selectedNodeId,
        mode,
        max_hops: 6,
      });
      setBlast(blastResult);
      if (blastResult.ok) {
        setBlastRadiusHighlight({
          unreachable: blastResult.unreachable_node_ids ?? [],
          degraded: blastResult.degraded_node_ids ?? [],
          edgeIds: blastResult.highlight_edge_ids ?? [],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na simulação");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setInjection(null);
    setBlast(null);
    setError(null);
    clearBlastRadiusHighlight();
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
          <Skull size={16} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Injeção de falha</p>
          <p className="mt-0.5 text-xs text-[var(--muted-fg)]">
            Selecione um serviço no canvas e simule indisponibilidade — blast radius no diagrama.
          </p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="fail-mode">
          Modo de falha
        </label>
        <select
          id="fail-mode"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="down">Down (503)</option>
          <option value="timeout">Timeout (SLO estourado)</option>
          <option value="degraded">Degradado (error budget)</option>
        </select>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Alvo:{" "}
        <strong className="text-slate-300">
          {selectedNodeId
            ? serviceNodes.find((n) => n.id === selectedNodeId)?.data.label ?? selectedNodeId
            : "nenhum nó selecionado"}
        </strong>
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-1.5"
          disabled={loading || !graphId || !selectedNodeId}
          onClick={() => void runInjection()}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Injetar falha
        </button>
        <button type="button" className="btn-ghost" onClick={clear}>
          Limpar highlight
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400" role="alert">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}

      {injection?.ok && (
        <div className="rounded-lg border border-[var(--border)] bg-black/25 p-3 text-xs text-slate-300">
          <p className="font-medium text-slate-100">{injection.summary}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{injection.unreachable_node_ids?.length ?? 0} nós indisponíveis</li>
            <li>{injection.degraded_node_ids?.length ?? 0} degradados</li>
            <li>{injection.journeys_broken_pct ?? 0}% dos serviços impactados</li>
            <li>
              Caminho crítico: {injection.critical_path_broken}/{injection.critical_path_total} quebrados
            </li>
          </ul>
          {(injection.fallback_activations?.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              <p className="font-medium text-amber-200">Fallbacks ativados</p>
              {injection.fallback_activations?.map((f, i) => (
                <p key={i} className="text-[var(--muted-fg)]">
                  {f.from} → {f.to}: {f.detail}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {blast?.hops && Object.keys(blast.hops).length > 0 && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-xs">
          <p className="font-medium text-rose-200">Blast por hop</p>
          {Object.entries(blast.hops).map(([hop, ids]) => (
            <p key={hop} className="mt-1 text-[var(--muted-fg)]">
              Hop {hop}: {ids.length} nó(s)
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
