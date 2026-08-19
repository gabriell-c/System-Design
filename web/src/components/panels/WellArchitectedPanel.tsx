"use client";

import { ShieldCheck } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";

export default function WellArchitectedPanel() {
  const analysis = useGraphStore((s) => s.analysis);
  const wa = analysis?.well_architected;

  if (!analysis) {
    return (
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-slate-400">Jalankan analisis untuk melihat Well-Architected Scorecard.</p>
      </div>
    );
  }

  if (!wa) {
    return (
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-slate-400">Scorecard Well-Architected belum tersedia.</p>
      </div>
    );
  }

  const pillars = [
    { name: "Operational Excellence", score: wa.narrative, key: "narrative" },
    { name: "Security", score: wa.views_completeness, key: "views_completeness" },
    { name: "Reliability", score: wa.placement, key: "placement" },
    { name: "Performance Efficiency", score: wa.flow_continuity, key: "flow_continuity" },
    { name: "Cost Optimization", score: wa.operability, key: "operability" },
    { name: "Sustainability", score: wa.decision_quality, key: "decision_quality" },
  ];

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
          <ShieldCheck size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Well-Architected Review</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            AWS Well-Architected Framework assessment (P1.2.7).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d1219] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">Overall Score</p>
          <span className={`text-2xl font-semibold tabular-nums ${
            wa.overall >= 7 ? "text-emerald-400" : wa.overall >= 5 ? "text-amber-400" : "text-rose-400"
          }`}>
            {wa.overall.toFixed(1)}
            <span className="text-sm text-slate-500">/10</span>
          </span>
        </div>
        {wa.review_ready && (
          <p className="mt-1 text-xs text-emerald-400">✓ Review Ready</p>
        )}
      </div>

      <div className="space-y-2">
        {pillars.map((pillar) => (
          <div key={pillar.key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <span className="flex-1 text-xs text-slate-200">{pillar.name}</span>
            <span className={`text-sm font-semibold ${
              pillar.score >= 7 ? "text-emerald-400" : pillar.score >= 5 ? "text-amber-400" : "text-rose-400"
            }`}>
              {pillar.score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {wa.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">Gaps to Address</p>
          <ul className="space-y-1">
            {wa.gaps.map((gap, i) => (
              <li key={i} className="text-xs text-amber-200/80">• {gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
