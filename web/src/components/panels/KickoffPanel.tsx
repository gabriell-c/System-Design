"use client";

import { CheckCircle2, CircleAlert, CircleDashed, ListChecks } from "lucide-react";
import { useMemo } from "react";
import { buildKickoffChecklist, kickoffScore } from "@/lib/kickoff";
import { useGraphStore } from "@/lib/graph-store";

export default function KickoffPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const nfr = useGraphStore((s) => s.nfr);
  const context = useGraphStore((s) => s.context);

  const items = useMemo(
    () => buildKickoffChecklist(nodes, edges, nfr, context),
    [nodes, edges, nfr, context],
  );
  const score = kickoffScore(items);

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
          <ListChecks size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Checklist de kickoff</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            O que costuma faltar ao iniciar um projeto — baseado no canvas + NFRs.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Prontidão</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${score.ready ? "text-emerald-300" : "text-amber-200"}`}>
          {score.ok}/{score.total}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {score.ready ? "Base mínima ok para discutir go-live." : "Ainda há buracos críticos no desenho."}
        </p>
        <p
          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            score.reviewReady ? "bg-emerald-500/20 text-emerald-200" : "bg-violet-500/15 text-violet-200"
          }`}
        >
          {score.reviewReady ? "review-ready (arquiteto)" : "canvas ok ≠ review-ready"}
        </p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-2.5 ${
              item.status === "ok"
                ? "border-emerald-500/25 bg-emerald-950/20"
                : item.status === "missing"
                  ? "border-rose-500/25 bg-rose-950/20"
                  : "border-amber-500/25 bg-amber-950/20"
            }`}
          >
            <div className="flex items-start gap-2">
              {item.status === "ok" ? (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
              ) : item.status === "missing" ? (
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-rose-300" />
              ) : (
                <CircleDashed size={14} className="mt-0.5 shrink-0 text-amber-300" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{item.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
