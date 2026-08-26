"use client";

import { useGraphStore } from "@/lib/graph-store";
import type { ArchStyle, Finding } from "@/lib/types";

const STYLE_LABELS: Record<string, string> = {
  monolithic: "Monolítica",
  layered: "Em camadas",
  microservices: "Microsserviços",
  event_driven: "Orientada a eventos",
  hexagonal: "Hexagonal",
  serverless: "Serverless",
  soa: "SOA",
};

const ARCH_STYLES: ArchStyle[] = [
  "monolithic",
  "layered",
  "microservices",
  "event_driven",
  "hexagonal",
  "serverless",
  "soa",
];

function severityClass(severity: Finding["severity"]): string {
  if (severity === "critical") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-sky-500/40 bg-sky-500/10 text-sky-100";
}

export default function ArchitecturePanel() {
  const analysis = useGraphStore((s) => s.analysis);
  const nfr = useGraphStore((s) => s.nfr);
  const setNfr = useGraphStore((s) => s.setNfr);
  const nodes = useGraphStore((s) => s.nodes);

  const zoneCount = nodes.filter((n) => n.data.kind === "zone").length;
  const styleFindings = analysis?.style_findings ?? [];

  function addChip(field: "business_processes" | "data_entities" | "data_governance", value: string) {
    const v = value.trim();
    if (!v) return;
    setNfr((prev) => {
      const list = [...(prev[field] ?? [])];
      if (!list.includes(v)) list.push(v);
      return { ...prev, [field]: list };
    });
  }

  function removeChip(field: "business_processes" | "data_entities" | "data_governance", value: string) {
    setNfr((prev) => ({
      ...prev,
      [field]: (prev[field] ?? []).filter((x) => x !== value),
    }));
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Arquitetura real</p>
        <p className="mt-1 text-xs text-[var(--muted-fg)]">
          {zoneCount} zona{zoneCount === 1 ? "" : "s"} no canvas · estilo declarado e coerência AN/AD/AA/AI
        </p>
      </div>

      <section>
        <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="arch-style">
          Estilo arquitetural (AN/AA)
        </label>
        <select
          id="arch-style"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
          value={nfr.arch_style ?? ""}
          onChange={(e) =>
            setNfr((prev) => ({
              ...prev,
              arch_style: (e.target.value || null) as ArchStyle | null,
            }))
          }
        >
          <option value="">Detectar automaticamente</option>
          {ARCH_STYLES.map((s) => (
            <option key={s} value={s}>
              {STYLE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
        {analysis?.arch_style && (
          <p className="mt-1.5 text-xs text-[var(--muted-fg)]">
            Detectado:{" "}
            <strong className="text-slate-200">{STYLE_LABELS[analysis.arch_style] ?? analysis.arch_style}</strong>
            {typeof analysis.style_confidence === "number"
              ? ` · confiança ${(analysis.style_confidence * 100).toFixed(0)}%`
              : ""}
          </p>
        )}
      </section>

      <ChipEditor
        title="Processos de negócio (AN)"
        items={nfr.business_processes ?? []}
        placeholder="Ex.: Autenticar usuário"
        onAdd={(v) => addChip("business_processes", v)}
        onRemove={(v) => removeChip("business_processes", v)}
      />
      <ChipEditor
        title="Entidades de dados (AD)"
        items={nfr.data_entities ?? []}
        placeholder="Ex.: Pedido, Cliente"
        onAdd={(v) => addChip("data_entities", v)}
        onRemove={(v) => removeChip("data_entities", v)}
      />
      <ChipEditor
        title="Governança de dados (AD)"
        items={nfr.data_governance ?? []}
        placeholder="Ex.: LGPD, retenção 90d"
        onAdd={(v) => addChip("data_governance", v)}
        onRemove={(v) => removeChip("data_governance", v)}
      />

      {analysis?.domain_coherence && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Coerência de domínios</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ["AN", analysis.domain_coherence.an],
                ["AD", analysis.domain_coherence.ad],
                ["AA", analysis.domain_coherence.aa],
                ["AI", analysis.domain_coherence.ai],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[var(--border)] bg-black/20 px-2 py-2">
                <span className="text-[var(--muted)]">{k}</span>
                <span className="ml-2 font-semibold tabular-nums text-slate-100">{v.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-fg)]">
            Geral: <strong className="text-slate-200">{analysis.domain_coherence.geral.toFixed(1)}</strong>/10
          </p>
        </section>
      )}

      {analysis?.review_scorecard && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Review scorecard
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                analysis.review_scorecard.review_ready
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-amber-500/20 text-amber-100"
              }`}
            >
              {analysis.review_scorecard.review_ready ? "review-ready" : "em evolução"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-200">
            Geral{" "}
            <strong className="tabular-nums">{analysis.review_scorecard.overall.toFixed(1)}</strong>
            /10
            {!analysis.review_scorecard.review_ready && (
              <span className="ml-2 text-xs text-[var(--muted)]">meta ≥ 8.0</span>
            )}
          </p>
          <ul className="mt-2 space-y-2">
            {(
              [
                ["Narrativa", analysis.review_scorecard.narrative],
                ["Vistas", analysis.review_scorecard.views_completeness],
                ["Placement", analysis.review_scorecard.placement],
                ["Fluxos", analysis.review_scorecard.flow_continuity],
                ["Operabilidade", analysis.review_scorecard.operability],
                ["Decisão", analysis.review_scorecard.decision_quality],
              ] as const
            ).map(([label, value]) => (
              <li key={label} className="text-sm text-[var(--muted-fg)]">
                <div className="mb-0.5 flex justify-between">
                  <span>{label}</span>
                  <span className="tabular-nums text-slate-200">{value.toFixed(1)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${value >= 8 ? "bg-emerald-400" : value >= 5 ? "bg-indigo-400" : "bg-rose-400"}`}
                    style={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {(analysis.review_scorecard.gaps?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
              <p className="text-sm font-semibold text-amber-200">O que falta para 8.0</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-amber-100/90">
                {analysis.review_scorecard.gaps.slice(0, 6).map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {analysis?.cohesion_coupling && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 text-xs text-[var(--muted-fg)]">
          Coesão {analysis.cohesion_coupling.cohesion_score.toFixed(1)} · Acoplamento{" "}
          {analysis.cohesion_coupling.coupling_score.toFixed(1)}
        </section>
      )}

      {styleFindings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Riscos de zona / estilo
          </h3>
          <ul className="space-y-2">
            {styleFindings.map((f, i) => (
              <li key={`${f.title}-${i}`} className={`rounded-lg border px-3 py-2 text-xs ${severityClass(f.severity)}`}>
                <p className="font-semibold">{f.title}</p>
                <p className="mt-0.5 opacity-90">{f.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(analysis?.trade_offs?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Trade-offs</h3>
          <ul className="space-y-2">
            {analysis!.trade_offs!.map((t, i) => (
              <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">{t.decisao}</p>
                <p className="mt-1 text-[var(--muted)]">vs {t.alternativa_rejeitada}</p>
                <p className="mt-1">+ {t.vantagem}</p>
                <p>− {t.desvantagem}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ChipEditor({
  title,
  items,
  placeholder,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  return (
    <section>
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onRemove(item)}
            className="rounded-full border border-[var(--border)] bg-white/5 px-2.5 py-0.5 text-sm text-slate-200 hover:border-rose-400/40 hover:text-rose-200"
            title="Remover"
          >
            {item} ×
          </button>
        ))}
      </div>
      <input
        className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
    </section>
  );
}
