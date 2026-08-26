"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { togafSummary } from "@/lib/togaf-adm";
import type { TogafPhase } from "@/lib/togaf-adm";

export default function TogafPanel() {
  const nodes = useGraphStore((s) => s.nodes);

  const summary = useMemo(() => togafSummary(nodes.map((n) => ({ data: n.data }))), [nodes]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">TOGAF ADM</p>
      <p className="text-sm text-[var(--muted-fg)]">Cobertura das fases do Architecture Development Method.</p>

      {/* Coverage badge */}
      <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Cobertura</span>
          <span
            className={`text-sm font-semibold ${
              summary.coverage.coveragePct >= 0.8 ? "text-emerald-400" :
              summary.coverage.coveragePct >= 0.5 ? "text-amber-400" :
              "text-rose-400"
            }`}
          >
            {(summary.coverage.coveragePct * 100).toFixed(0)}%
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-violet-500"
            style={{ width: `${summary.coverage.coveragePct * 100}%` }}
          />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-1">
        {summary.phases.map(({ phase, count }) => {
          const phaseInfo = getPhaseInfo(phase);
          return (
            <div
              key={phase}
              className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-violet-300">{phaseInfo.short}</span>
                <span className="text-sm text-slate-200">{phaseInfo.label}</span>
              </div>
              <span className="text-sm text-[var(--muted)]">{count} nós</span>
            </div>
          );
        })}
      </div>

      {/* Gaps */}
      {summary.coverage.gaps.length > 0 && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
          <p className="text-sm font-semibold text-rose-300">Fases sem cobertura:</p>
          <ul className="mt-1 space-y-0.5 text-sm text-rose-200">
            {summary.coverage.gaps.map((g) => (
              <li key={g}>• {getPhaseInfo(g).label}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <p className="text-sm text-[var(--muted-fg)]">{summary.recommendation}</p>
    </div>
  );
}

function getPhaseInfo(phase: TogafPhase) {
  const map: Record<TogafPhase, { label: string; short: string }> = {
    preliminar: { label: "Preliminar", short: "Pre" },
    fase_a: { label: "Visões", short: "A" },
    fase_b: { label: "Negócio", short: "B" },
    fase_c: { label: "Sistemas", short: "C" },
    fase_d: { label: "Tecnologia", short: "D" },
    fase_e: { label: "Oportun.", short: "E" },
    fase_f: { label: "Planej.", short: "F" },
    fase_g: { label: "Impl.", short: "G" },
    fase_h: { label: "Mudanças", short: "H" },
    requisitos: { label: "Req.", short: "R" },
  };
  return map[phase];
}
