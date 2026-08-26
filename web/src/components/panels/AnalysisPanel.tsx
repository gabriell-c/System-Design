"use client";

import { useGraphStore } from "@/lib/graph-store";
import type { Finding, GrowthScenario } from "@/lib/types";
import PanelEmpty from "@/components/ui/PanelEmpty";
import { Search, Sparkles } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

function severityClass(severity: Finding["severity"]): string {
  if (severity === "critical") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-sky-500/40 bg-sky-500/10 text-sky-100";
}

export default function AnalysisPanel() {
  const analysis = useGraphStore((s) => s.analysis);
  const analyzing = useGraphStore((s) => s.analyzing);
  const analyzeError = useGraphStore((s) => s.analyzeError);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const highlightCriticalNodes = useGraphStore((s) => s.highlightNodeIds);
  const setHighlightNodeIds = useGraphStore((s) => s.setHighlightNodeIds);

  if (analyzing) {
    return (
      <div className="px-4 py-6">
        <Skeleton rows={5} />
      </div>
    );
  }
  if (analyzeError) {
    return (
      <PanelEmpty
        icon={Sparkles}
        title="Falha na análise"
        description={`${analyzeError} Verifique a conexão e tente novamente.`}
      />
    );
  }
  if (!analysis) {
    return (
      <PanelEmpty
        icon={Sparkles}
        title="Ainda sem análise"
        description="Preencha o Contexto, monte o canvas e clique em Analisar na barra superior."
      />
    );
  }

  const nodeFindings = analysis.findings.filter((f) => f.node_id === selectedNodeId);
  const globalFindings = analysis.findings.filter((f) => !f.node_id);
  const criticalNodeIds = analysis.score_breakdown?.critical_node_ids ?? [];
  const bottleneckFindings = analysis.findings
    .filter(
      (f) =>
        Boolean(f.node_id) && (f.severity === "warning" || f.severity === "critical"),
    )
    .slice()
    .sort((a, b) => {
      const rank = (s: Finding["severity"]) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
      return rank(a.severity) - rank(b.severity);
    });

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Nota geral</p>
          <span className="text-2xl font-semibold tabular-nums text-slate-50">{analysis.score.toFixed(1)}</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{analysis.summary}</p>
        {analysis.arch_style && (
          <p className="mt-2 text-xs text-violet-300">
            Estilo: <strong>{analysis.arch_style}</strong>
            {typeof analysis.style_confidence === "number"
              ? ` (${(analysis.style_confidence * 100).toFixed(0)}%)`
              : ""}
          </p>
        )}
        {analysis.review_scorecard && (
          <p className="mt-2 text-xs text-[var(--muted-fg)]">
            Review scorecard:{" "}
            <strong className="text-slate-200">{analysis.review_scorecard.overall.toFixed(1)}/10</strong>
            {analysis.review_scorecard.review_ready ? (
              <span className="ml-2 text-emerald-300">review-ready</span>
            ) : (
              <span className="ml-2 text-amber-200">meta ≥ 8.0 — ver aba Arquitetura</span>
            )}
          </p>
        )}
        {!analysis.ia_ok && (
          <p className="mt-2 text-xs text-amber-300">
            IA indisponível — relatório heurístico local. {analysis.ia_unavailable ? "OmniRoute não respondeu." : ""}
          </p>
        )}
        {analysis.score_breakdown && (
          <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-500/10 p-2">
            <p className="text-sm font-semibold text-violet-200">Por que {analysis.score.toFixed(1)}?</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-300">
              {analysis.score_breakdown.factors.map((f) => (
                <li key={f.label}>
                  {f.label}: {f.impact >= 0 ? "+" : ""}
                  {f.impact.toFixed(1)} — {f.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(analysis.benchmarks?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Benchmarks por domínio
          </h3>
          <ul className="space-y-2">
            {analysis.benchmarks!.map((b) => (
              <li key={b.domain} className="rounded-lg border border-[var(--border)] px-2 py-2 text-xs">
                <span className={b.status === "fail" ? "text-rose-300" : "text-emerald-300"}>{b.domain}</span>
                <span className="text-[var(--muted)]"> · {b.triggered_rules.length} regra(s)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {criticalNodeIds.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-300">
              Nós críticos ({criticalNodeIds.length})
            </h3>
            <button
              type="button"
              className="text-sm text-indigo-300 hover:text-indigo-100"
              onClick={() => setHighlightNodeIds(highlightCriticalNodes.length ? [] : criticalNodeIds)}
            >
              {highlightCriticalNodes.length ? "Limpar destaque" : "Destacar no canvas"}
            </button>
          </div>
          <ul className="space-y-1">
            {criticalNodeIds.map((id) => (
              <li key={id} className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                {id}
              </li>
            ))}
          </ul>
        </section>
      )}

      {bottleneckFindings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-300">
            Bottlenecks ({bottleneckFindings.length})
          </h3>
          <p className="mb-2 text-sm text-[var(--muted)]">
            Cards em pulse vermelho no canvas — o componente culpado, não o sintoma.
          </p>
          <FindingList items={bottleneckFindings} />
        </section>
      )}

      {selectedNodeId && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Node selecionado</h3>
          {nodeFindings.length === 0 ? (
            <PanelEmpty
              icon={Search}
              title="Sem achados neste node"
              description="Nenhum achado específico para o componente selecionado."
            />
          ) : (
            <FindingList items={nodeFindings} />
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Achados globais</h3>
        <FindingList items={globalFindings} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Pontos fortes</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
          {analysis.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Riscos</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
          {analysis.risks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Sugestões</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
          {analysis.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Crescimento</h3>
        <GrowthCard title="Pequeno · ~1 mil usuários" scenario={analysis.growth.small} />
        <GrowthCard title="Médio · ~100 mil usuários" scenario={analysis.growth.medium} />
        <GrowthCard title="Grande · 1 milhão+" scenario={analysis.growth.large} />
      </section>
    </div>
  );
}

function FindingList({ items }: { items: Finding[] }) {
  const applyFix = useGraphStore((s) => s.applyFixFromFinding);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const setHighlightNodeIds = useGraphStore((s) => s.setHighlightNodeIds);
  if (items.length === 0) {
    return (
      <PanelEmpty
        icon={Search}
        title="Nenhum achado"
        description="Nada a listar nesta seção."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={`${item.title}-${item.node_id ?? "g"}`} className={`rounded-lg border p-2.5 ${severityClass(item.severity)}`}>
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-1 text-xs opacity-90">{item.detail}</p>
          {item.metric && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-0.5 text-sm uppercase tracking-wide">
              {item.metric.label}: {item.metric.value}
              {item.metric.unit ? ` ${item.metric.unit}` : ""}
              <span className="rounded bg-white/10 px-1">estimativa</span>
            </p>
          )}
          {item.fix_action && (
            <button
              type="button"
              className="mt-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-2 py-1 text-sm font-medium text-indigo-100 hover:bg-[var(--accent-muted)]"
              onClick={() => {
                const ok = applyFix(item.fix_action!);
                pushUiNotice(
                  ok
                    ? { type: "success", text: `Fix aplicado: ${item.fix_action!.label}` }
                    : { type: "error", text: "Não foi possível aplicar o fix." },
                );
              }}
            >
              Aplicar fix — {item.fix_action.label}
            </button>
          )}
          {item.evidence_node_ids?.length ? (
            <button
              type="button"
              className="mt-1 rounded border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-sm text-slate-300 hover:bg-slate-500/20"
              onClick={() => setHighlightNodeIds(item.evidence_node_ids!)}
            >
              Ver evidência no canvas ({item.evidence_node_ids.length} nó(s))
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function GrowthCard({ title, scenario }: { title: string; scenario: GrowthScenario }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <span className={`text-sm font-semibold uppercase ${scenario.ok ? "text-emerald-300" : "text-amber-300"}`}>
          {scenario.ok ? "Adequada" : "Precisa mudar"}
        </span>
      </div>
      {scenario.issues.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-[var(--muted-fg)]">
          {scenario.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      {scenario.changes.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-indigo-200/90">
          {scenario.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
