"use client";

import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiRateLimitError } from "@/lib/api";
import PanelHeader from "@/components/ui/PanelHeader";
import PanelEmpty from "@/components/ui/PanelEmpty";
import { useGraphStore } from "@/lib/graph-store";
import {
  countBySeverity,
  emptyStateText,
  fixVisible,
  groupByModelAndSeverity,
  isStale,
  rateLimitMessage,
  showRecalculate,
} from "@/lib/threat-view";
import type { Finding, ThreatAnalysisResult } from "@/lib/types";

function severityClass(severity: string): string {
  if (severity === "critical") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-sky-500/40 bg-sky-500/10 text-sky-100";
}

function ThreatFindingItem({ finding }: { finding: Finding }) {
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const applyFix = useGraphStore((s) => s.applyFixFromFinding);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  // Clique só com `node_id` (padrão CostPanel: seleciona + highlight no canvas).
  const clickable = finding.node_id != null;
  return (
    <li
      className={`rounded-lg border p-2.5 ${severityClass(finding.severity)} ${
        clickable ? "cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]" : ""
      }`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${finding.title} — selecionar no canvas` : undefined}
      onClick={clickable ? () => setSelectedNodeId(finding.node_id!) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && setSelectedNodeId(finding.node_id!) : undefined}
    >
      <p className="text-sm font-medium">{finding.title}</p>
      <p className="mt-1 text-xs opacity-90">{finding.detail}</p>
      {finding.metric && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-0.5 text-xs uppercase tracking-wide">
          {finding.metric.label}: {finding.metric.value}
          {finding.metric.unit ? ` ${finding.metric.unit}` : ""}
          <span className="rounded bg-white/10 px-1">estimativa</span>
        </p>
      )}
      {/* stopPropagation: o "Aplicar fix" não deve selecionar o nó junto (padrão AnalysisPanel). */}
      {fixVisible(finding) && (
        <button
          type="button"
          className="mt-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-2 py-1 text-sm font-medium text-indigo-100 hover:bg-[var(--accent-muted)]"
          onClick={(e) => {
            e.stopPropagation();
            const ok = applyFix(finding.fix_action!);
            pushUiNotice(
              ok
                ? { type: "success", text: `Fix aplicado: ${finding.fix_action!.label}` }
                : { type: "error", text: "Não foi possível aplicar o fix." },
            );
          }}
        >
          Aplicar fix — {finding.fix_action!.label}
        </button>
      )}
    </li>
  );
}

/**
 * R7 (plano threat) — painél de Ameaças com fonte de dados PRÓPRIA
 * (GET /graphs/{id}/threat-analysis), não `store.analysis` (estado do
 * pipeline LLM):
 * - fetch base com AbortController (cancela em unmount/troca de gráfico);
 * - re-fetch na transição do save para "saved" (lastSaveStatusRef);
 * - dirty hint + "Recalcular com canvas" (POST live) SÓ com canvas sujo;
 * - grupos por `finding.model` → severidade (lógica pura em threat-view);
 * - 429 → rateLimitMessage (reaproveitada do cost-view);
 * - erro NUNCA engolido: banner + "Tentar de novo".
 */
export default function ThreatAnalysisPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const saveStatus = useGraphStore((s) => s.saveStatus);
  // MESMA ruling do CostPanel: a store já tem a flag — `dirty`
  // (document-slice) e `saveStatus === "dirty"` (save-slice).
  const dirty = useGraphStore((s) => s.dirty || s.saveStatus === "dirty");

  const [data, setData] = useState<ThreatAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const liveControllerRef = useRef<AbortController | null>(null);
  const lastSaveStatusRef = useRef(saveStatus);

  const stale = isStale(dirty, saveStatus);

  // Re-fetch base apenas na transição p/ "saved" (ref do último valor —
  // "dirty"/"saving"/"error" não re-disparam; padrão CostPanel).
  useEffect(() => {
    const prev = lastSaveStatusRef.current;
    lastSaveStatusRef.current = saveStatus;
    if (graphId && saveStatus === "saved" && prev !== "saved") {
      setFetchTick((t) => t + 1);
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
      .threatAnalysis(graphId, controller.signal)
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
  }, [graphId, fetchTick]);

  // Cancela o live em flight no unmount (abort do base já cobre troca de
  // gráfico: a closure refazia com o novo `graphId`).
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
    const { nodes, edges, nfr } = useGraphStore.getState();
    try {
      const result = await api.threatAnalysisLive(graphId, { nodes, edges, nfr }, controller.signal);
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

  if (!graphId) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">Salve o diagrama para ver ameaças.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4">
        <div className="h-16 animate-pulse rounded-lg border border-[var(--border)] bg-white/5" />
        <div className="h-32 animate-pulse rounded-lg border border-[var(--border)] bg-white/5" />
        <p className="flex items-center gap-2 text-xs text-[var(--muted-fg)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisando ameaças…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 px-4 py-4">
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300"
        >
          <AlertTriangle size={14} />
          {error}
        </p>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5"
          onClick={() => setFetchTick((t) => t + 1)}
        >
          <RefreshCw size={14} />
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!data) return null;

  const counts = countBySeverity(data.findings);

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={ShieldAlert}
        chipClass="bg-rose-500/15 text-rose-300"
        title="Ameaças (STRIDE + LINDDUN)"
        subtitle={
          <>
            <p>{data.summary}</p>
            <p>Heurística determinística (v{data.version}) — triagem, não auditoria.</p>
          </>
        }
      />

      {/* Canvas sujo → os checks rodam sobre o grafo salvo, não o canvas */}
      {stale && (
        <div className="space-y-2">
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            Canvas mudou — resultados baseados no último grafo salvo.
          </p>
          {showRecalculate(dirty, saveStatus) && (
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5"
              disabled={liveLoading}
              onClick={() => void recalcFromCanvas()}
            >
              {liveLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Recalcular com canvas
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-slate-300">
            {data.total}
            {live && (
              <span className="ml-1.5 align-middle rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                preview (não salvo)
              </span>
            )}
          </p>
          <p className="text-sm uppercase text-[var(--muted)]">Ameaças</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-rose-300">{counts.critical}</p>
          <p className="text-sm uppercase text-[var(--muted)]">Críticas</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
          <p className="text-lg font-bold text-amber-300">{counts.warning}</p>
          <p className="text-sm uppercase text-[var(--muted)]">Alertas</p>
        </div>
      </div>

      {data.findings.length === 0 ? (
        <PanelEmpty
          icon={ShieldCheck}
          title="Nenhuma ameaça identificada"
          description={emptyStateText(data.summary, data.version)}
        />
      ) : (
        groupByModelAndSeverity(data).map((group) => (
          <section key={group.key}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{group.label}</h3>
            {group.sections.map((section) => (
              <div key={section.severity} className="mb-2">
                <h4
                  className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${
                    section.severity === "critical"
                      ? "text-rose-300"
                      : section.severity === "warning"
                        ? "text-amber-300"
                        : "text-sky-300"
                  }`}
                >
                  {section.label} ({section.findings.length})
                </h4>
                <ul className="space-y-2">
                  {section.findings.map((f) => (
                    <ThreatFindingItem key={`${f.title}-${f.node_id ?? "g"}`} finding={f} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}

      {liveError && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400" role="alert">
          <AlertTriangle size={14} />
          {liveError}
        </p>
      )}
    </div>
  );
}
