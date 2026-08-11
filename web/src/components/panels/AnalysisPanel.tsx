"use client";

import { useGraphStore } from "@/lib/graph-store";
import type { Finding, GrowthScenario } from "@/lib/types";

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

  if (analyzing) {
    return <p className="px-4 py-6 text-sm text-slate-400">Analisando arquitetura…</p>;
  }
  if (analyzeError) {
    return <p className="px-4 py-6 text-sm text-rose-300">{analyzeError}</p>;
  }
  if (!analysis) {
    return (
      <div className="space-y-3 px-4 py-6 text-sm text-slate-400">
        <p className="font-medium text-slate-200">Ainda sem análise</p>
        <p>
          A <strong className="text-slate-300">Análise</strong> julga se o desenho faz sentido para o contexto do
          projeto (over/under-engineering, riscos, nota).
        </p>
        <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-500">
          <li>Preencha Contexto (aba ao lado)</li>
          <li>Monte blocos + cards no canvas</li>
          <li>Clique em Analisar na barra superior</li>
        </ol>
        <p className="text-xs text-slate-500">
          Também há reanálise automática ~2s após editar. Para testar carga/jornada, use a aba{" "}
          <strong className="text-slate-400">Simulação</strong>.
        </p>
      </div>
    );
  }

  const nodeFindings = analysis.findings.filter((f) => f.node_id === selectedNodeId);
  const globalFindings = analysis.findings.filter((f) => !f.node_id);

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-xl border border-white/10 bg-[#0d1219] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">Nota geral</p>
          <span className="text-2xl font-semibold tabular-nums text-slate-50">{analysis.score.toFixed(1)}</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{analysis.summary}</p>
        {!analysis.ia_ok && (
          <p className="mt-2 text-xs text-amber-300">
            IA indisponível — relatório heurístico local. {analysis.ia_unavailable ? "OmniRoute não respondeu." : ""}
          </p>
        )}
      </div>

      {selectedNodeId && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Node selecionado</h3>
          {nodeFindings.length === 0 ? (
            <p className="text-xs text-slate-500">Sem achados específicos neste node.</p>
          ) : (
            <FindingList items={nodeFindings} />
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Achados globais</h3>
        <FindingList items={globalFindings} />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pontos fortes</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
          {analysis.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Riscos</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
          {analysis.risks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sugestões</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
          {analysis.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Crescimento</h3>
        <GrowthCard title="Pequeno · ~1 mil usuários" scenario={analysis.growth.small} />
        <GrowthCard title="Médio · ~100 mil usuários" scenario={analysis.growth.medium} />
        <GrowthCard title="Grande · 1 milhão+" scenario={analysis.growth.large} />
      </section>
    </div>
  );
}

function FindingList({ items }: { items: Finding[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">Nenhum achado.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={`${item.title}-${item.node_id ?? "g"}`} className={`rounded-lg border p-2.5 ${severityClass(item.severity)}`}>
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-1 text-xs opacity-90">{item.detail}</p>
          {item.metric && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {item.metric.label}: {item.metric.value}
              {item.metric.unit ? ` ${item.metric.unit}` : ""}
              <span className="rounded bg-white/10 px-1">estimativa</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function GrowthCard({ title, scenario }: { title: string; scenario: GrowthScenario }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1219] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <span className={`text-[10px] font-semibold uppercase ${scenario.ok ? "text-emerald-300" : "text-amber-300"}`}>
          {scenario.ok ? "Adequada" : "Precisa mudar"}
        </span>
      </div>
      {scenario.issues.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-slate-400">
          {scenario.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      {scenario.changes.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-cyan-200/90">
          {scenario.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
