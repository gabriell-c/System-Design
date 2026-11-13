"use client";

import { AlertTriangle, Loader2, Network, RefreshCw, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiRateLimitError } from "@/lib/api";
import PanelHeader from "@/components/ui/PanelHeader";
import { useGraphStore } from "@/lib/graph-store";
import { rateLimitMessage } from "@/lib/cost-view";
import { findingsCounts, flowsSummary, scoreLabel } from "@/lib/network-view";
import type { DeploymentFlowsResult, NetworkPolicyFinding, NetworkPolicyResult } from "@/lib/types";

interface Props {
  graphId: string;
}

function errorMessage(e: unknown): string {
  // 429 do rate_limit_network (30/60s) ganha a mensagem específica com
  // retryAfter (mesma helper do CostPanel); demais erros → mensagem crua.
  return e instanceof ApiRateLimitError ? rateLimitMessage(e.retryAfter) : e instanceof Error ? e.message : "Erro";
}

function scoreBadgeClass(label: string): string {
  if (label === "Boa") return "bg-emerald-500/20 text-emerald-200";
  if (label === "Atenção") return "bg-amber-500/20 text-amber-200";
  return "bg-rose-500/20 text-rose-200";
}

function severityChipClass(severity: string): string {
  if (severity === "critical") return "bg-rose-500/20 text-rose-200";
  if (severity === "warning") return "bg-amber-500/20 text-amber-200";
  return "bg-sky-500/20 text-sky-200";
}

function severityChipLabel(severity: string): string {
  if (severity === "critical") return "Crítica";
  if (severity === "warning") return "Alerta";
  return "Info";
}

function NetworkFindingItem({ finding }: { finding: NetworkPolicyFinding }) {
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  // Clique seleciona o nó SÓ com `node_id` presente (padrão CostPanel).
  const clickable = finding.node_id != null;
  return (
    <li
      className={`flex items-start gap-2 rounded-lg border border-[var(--border)] bg-black/20 p-2 ${
        clickable ? "cursor-pointer hover:border-sky-500/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]" : ""
      }`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${finding.title} — selecionar no canvas` : undefined}
      onClick={clickable ? () => setSelectedNodeId(finding.node_id!) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && setSelectedNodeId(finding.node_id!) : undefined}
    >
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityChipClass(finding.severity)}`}>
        {severityChipLabel(finding.severity)}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{finding.title}</p>
        <p className="mt-0.5 text-xs text-[var(--muted-fg)]">{finding.detail}</p>
      </div>
    </li>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={onRetry}>
      <RefreshCw size={14} />
      Tentar de novo
    </button>
  );
}

/**
 * R8 (plano threat) — aba "Rede" do Inspector: consome
 * `api.networkPolicy` + `api.deploymentFlows` (grafo SALVO — com canvas
 * sujo, hint de stale pede salvar). Estados loading/erro(retry)/vazio;
 * NADA de catch silencioso. Lógica pura (score→label, contagens) vive em
 * network-view.ts.
 */
export default function NetworkPanel({ graphId }: Props) {
  // Dados vêm do grafo SALVO: hint de stale segue a MESMA ruling do
  // CostPanel (`dirty` no document-slice OU `saveStatus === "dirty"`).
  const dirty = useGraphStore((s) => s.dirty || s.saveStatus === "dirty");

  const [policy, setPolicy] = useState<NetworkPolicyResult | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [flows, setFlows] = useState<DeploymentFlowsResult | null>(null);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const policyController = new AbortController();
    const flowsController = new AbortController();
    setPolicy(null);
    setFlows(null);
    setPolicyLoading(true);
    setFlowsLoading(true);
    setPolicyError(null);
    setFlowsError(null);
    api
      .networkPolicy(graphId, policyController.signal)
      .then((result) => {
        if (!policyController.signal.aborted) setPolicy(result);
      })
      .catch((e: unknown) => {
        if (policyController.signal.aborted) return;
        setPolicyError(errorMessage(e));
      })
      .finally(() => {
        if (!policyController.signal.aborted) setPolicyLoading(false);
      });
    api
      .deploymentFlows(graphId, flowsController.signal)
      .then((result) => {
        if (!flowsController.signal.aborted) setFlows(result);
      })
      .catch((e: unknown) => {
        if (flowsController.signal.aborted) return;
        setFlowsError(errorMessage(e));
      })
      .finally(() => {
        if (!flowsController.signal.aborted) setFlowsLoading(false);
      });
    return () => {
      policyController.abort();
      flowsController.abort();
    };
  }, [graphId, tick]);

  const retry = () => setTick((t) => t + 1);
  const counts = policy ? findingsCounts(policy.findings) : null;
  const flowCounts = flows ? flowsSummary(flows) : null;

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={Network}
        chipClass="bg-sky-500/15 text-sky-300"
        title="Rede"
        subtitle="Política de rede (SG/NACL/TGW) e fluxos de deploy do grafo salvo."
      />

      {/* Dados vêm do grafo SALVO — canvas sujo pede salvar (sem endpoint
      live de rede nesta feature: ruling R3 do plano). */}
      {dirty && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Canvas mudou — análise sobre o último grafo salvo. Salve o canvas para reanalisar.
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Política de rede</h3>
        {policyLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-3 text-xs text-[var(--muted-fg)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando política de rede…
          </div>
        )}
        {policyError && !policyLoading && (
          <div className="space-y-2">
            <p role="alert" className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
              <AlertTriangle size={14} />
              {policyError}
            </p>
            <RetryButton onRetry={retry} />
          </div>
        )}
        {policy && !policyError && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${scoreBadgeClass(scoreLabel(policy.score))}`}>
                {policy.score}/100 · {scoreLabel(policy.score)}
              </span>
              <span className="text-xs text-[var(--muted-fg)]">
                SG: {policy.summary.security_groups} · NACL: {policy.summary.nacls} · TGW:{" "}
                {policy.summary.transit_gateways} · arestas: {policy.summary.edges_analyzed}
              </span>
            </div>
            {counts && (
              <p className="text-xs text-[var(--muted-fg)]">
                Achados: {counts.critical} críticos · {counts.warning} alertas · {counts.info} info
              </p>
            )}
            {policy.findings.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-xs text-[var(--muted-fg)]">
                Sem achados de política de rede no grafo salvo.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto custom-scroll">
                {policy.findings.map((f, i) => (
                  <NetworkFindingItem key={`${f.title}-${f.node_id ?? f.edge_id ?? i}`} finding={f} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Workflow size={14} className="text-indigo-400" />
          Fluxos de deploy
        </h3>
        {flowsLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-3 text-xs text-[var(--muted-fg)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando fluxos de deploy…
          </div>
        )}
        {flowsError && !flowsLoading && (
          <div className="space-y-2">
            <p role="alert" className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
              <AlertTriangle size={14} />
              {flowsError}
            </p>
            <RetryButton onRetry={retry} />
          </div>
        )}
        {flows && !flowsError && flowCounts && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
              <p className="text-lg font-bold text-emerald-300">{flowCounts.dev}</p>
              <p className="text-[10px] uppercase text-[var(--muted)]">Deploy (dev)</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
              <p className="text-lg font-bold text-sky-300">{flowCounts.user}</p>
              <p className="text-[10px] uppercase text-[var(--muted)]">Usuário</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2">
              <p className="text-lg font-bold text-amber-300">{flowCounts.cross}</p>
              <p className="text-[10px] uppercase text-[var(--muted)]">Cruzado</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
