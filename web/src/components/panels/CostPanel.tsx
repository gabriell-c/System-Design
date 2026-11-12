"use client";

import { AlertTriangle, Copy, DollarSign, Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiRateLimitError } from "@/lib/api";
import PanelHeader from "@/components/ui/PanelHeader";
import { useGraphStore } from "@/lib/graph-store";
import { buildCostCsv, downloadCsv, formatUsd, pctShare, rateLimitMessage } from "@/lib/cost-view";
import type { CostBreakdown } from "@/lib/types";

/**
 * Painel de Custos (contrato (c) do plano de custo). Rulings:
 * - fetch base com AbortController (cancela em unmount/troca de gráfico);
 * - re-fetch na transição do save para "saved" (ref de último valor — não
 *   re-fetcha em "dirty"/"saving"/"error");
 * - "Recalcular com canvas" (POST /cost-estimate/live) visível SÓ com canvas
 *   sujo; resultado fica marcado "preview (não salvo)";
 * - 429 → mensagem com retryAfter; demais erros → mensagem crua.
 */
export default function CostPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const saveStatus = useGraphStore((s) => s.saveStatus);
  // Ruling (mesmo do ResiliencePanel): a store já tem a flag — `dirty`
  // (document-slice) e `saveStatus === "dirty"` (save-slice).
  const dirty = useGraphStore((s) => s.dirty || s.saveStatus === "dirty");
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);

  const liveControllerRef = useRef<AbortController | null>(null);
  const lastSaveStatusRef = useRef(saveStatus);

  // Re-fetch base apenas na transição p/ "saved" (ref do último valor —
  // "dirty"/"saving" não re-disparam).
  useEffect(() => {
    const prev = lastSaveStatusRef.current;
    lastSaveStatusRef.current = saveStatus;
    if (graphId && saveStatus === "saved" && prev !== "saved") {
      setSaveTick((t) => t + 1);
    }
  }, [graphId, saveStatus]);

  useEffect(() => {
    const controller = new AbortController();
    if (!graphId) {
      setData(null);
      setLive(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setLive(false);
    api
      .costEstimate(graphId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        // 404 (grafo apagado) e demais: limpa dados estale e mostra a
        // mensagem; 429 ganha o texto específico com retryAfter.
        setData(null);
        setLive(false);
        setError(e instanceof ApiRateLimitError ? rateLimitMessage(e.retryAfter) : e instanceof Error ? e.message : "Erro");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [graphId, saveTick]);

  // Cancela o live em flight no unmount (o abort do base já cobre troca de
  // gráfico: o `when` da closure era o grafo antigo).
  useEffect(
    () => () => {
      liveControllerRef.current?.abort();
    },
    [graphId],
  );

  async function recalcFromCanvas() {
    if (!graphId) return;
    const controller = new AbortController();
    liveControllerRef.current = controller;
    setLiveLoading(true);
    setLiveError(null);
    const { nodes, edges } = useGraphStore.getState();
    try {
      const result = await api.costEstimateLive(graphId, { nodes, edges }, controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setLive(true);
    } catch (e) {
      if (controller.signal.aborted) return;
      setLiveError(e instanceof ApiRateLimitError ? rateLimitMessage(e.retryAfter) : e instanceof Error ? e.message : "Erro");
    } finally {
      if (!controller.signal.aborted) setLiveLoading(false);
    }
  }

  async function copyCsv() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildCostCsv(data));
      pushUiNotice({ type: "success", text: "CSV dos custos copiado." });
    } catch {
      // Clipboard indisponível (contexto inseguro/permissão negada) — aviso
      // no lugar de engolir a falha silenciosamente.
      pushUiNotice({ type: "error", text: "Não foi possível copiar o CSV." });
    }
  }

  if (!graphId) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">Salve o diagrama para ver custos.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-[var(--muted-fg)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando custos…
      </div>
    );
  }

  if (error) {
    return (
      <p className="flex items-center gap-1.5 px-4 py-6 text-sm text-rose-400" role="alert">
        <AlertTriangle size={14} />
        {error}
      </p>
    );
  }

  if (!data) return null;

  const csvEnabled = data.line_items.length > 0;
  const csvFilename = `custos-${graphId ?? "draft"}.csv`;
  const total = data.total_usd_month;

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={DollarSign}
        chipClass="bg-emerald-500/15 text-emerald-300"
        title="Custos"
        subtitle={
          <>
            <p>{data.summary}</p>
            <p>
              Tabela estática (v{data.price_table_version}) — ordem de grandeza, não orçamento.
            </p>
          </>
        }
      />

      {/* Canvas sujo → a estimativa roda sobre o banco, não sobre o canvas */}
      {dirty && (
        <div className="space-y-2">
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            Estimado sobre a versão salva — salve o diagrama ou recalcule com o canvas atual.
          </p>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5"
            disabled={liveLoading}
            onClick={() => void recalcFromCanvas()}
          >
            {liveLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Recalcular com canvas
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-emerald-300">
            {formatUsd(total)}
            {live && (
              <span className="ml-1.5 align-middle rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                preview (não salvo)
              </span>
            )}
          </p>
          <p className="text-sm uppercase text-[var(--muted)]">Total / mês</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-slate-300">{data.node_count}</p>
          <p className="text-sm uppercase text-[var(--muted)]">Nós</p>
        </div>
      </div>

      {data.priced_count < data.node_count && (
        <p className="text-xs text-[var(--muted-fg)]">
          {data.node_count - data.priced_count} nós fora da tabela de preços (custo 0)
        </p>
      )}

      {Object.keys(data.by_region).length > 0 && (
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Por região</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-300">
            {Object.entries(data.by_region).map(([region, usd]) => (
              <li key={region} className="flex justify-between">
                <span>{region}</span>
                <span className="tabular-nums text-emerald-300">
                  {formatUsd(usd)} <span className="text-[var(--muted)]">({pctShare(usd, total)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {csvEnabled ? (
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Por serviço</p>
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs custom-scroll">
            {data.line_items.map((item) => (
              <li
                key={item.node_id}
                role="button"
                tabIndex={0}
                aria-label={`${item.label} — selecionar no canvas`}
                onClick={() => setSelectedNodeId(item.node_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelectedNodeId(item.node_id);
                }}
                className="flex cursor-pointer items-center justify-between gap-2 rounded border border-[var(--border)] px-2 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 hover:border-emerald-500/40"
              >
                <span className="truncate text-slate-300">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                  <span className="text-[var(--muted)]">{pctShare(item.cost_usd_month, total)}%</span>
                  {item.priced ? (
                    <span className="text-emerald-300">{formatUsd(item.cost_usd_month)}</span>
                  ) : (
                    <span title="Fora da tabela de preços" className="text-[var(--muted)]">
                      —
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-fg)]">Nenhum serviço precificado neste grafo.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5"
          disabled={!csvEnabled}
          onClick={() => void copyCsv()}
        >
          <Copy size={14} />
          Copiar CSV
        </button>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5"
          disabled={!csvEnabled}
          onClick={() => downloadCsv(csvFilename, buildCostCsv(data))}
        >
          <Download size={14} />
          Baixar CSV
        </button>
      </div>

      {liveError && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400" role="alert">
          <AlertTriangle size={14} />
          {liveError}
        </p>
      )}
    </div>
  );
}
