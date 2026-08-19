"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";
import type { Finding } from "@/lib/types";

function severityClass(severity: string): string {
  if (severity === "critical") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-sky-500/40 bg-sky-500/10 text-sky-100";
}

function FindingItem({ finding }: { finding: Finding }) {
  return (
    <li className={`rounded-lg border p-2.5 ${severityClass(finding.severity)}`}>
      <p className="text-xs font-medium">{finding.title}</p>
      <p className="mt-1 text-[11px] opacity-90">{finding.detail}</p>
      {finding.metric && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
          {finding.metric.label}: {finding.metric.value}
          {finding.metric.unit ? ` ${finding.metric.unit}` : ""}
          <span className="rounded bg-white/10 px-1">estimativa</span>
        </p>
      )}
    </li>
  );
}

export default function ThreatAnalysisPanel() {
  const analysis = useGraphStore((s) => s.analysis);
  const threatFindings = analysis?.threat_findings ?? [];

  if (!analysis) {
    return (
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-slate-400">Jalankan analisis untuk melihat ancaman.</p>
      </div>
    );
  }

  const critical = threatFindings.filter((f) => f.severity === "critical");
  const warnings = threatFindings.filter((f) => f.severity === "warning");
  const info = threatFindings.filter((f) => f.severity === "info");

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
          <ShieldAlert size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Threat Analysis (STRIDE + LINDDUN)</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Analisis ancaman keamanan arsitektur Anda.
          </p>
        </div>
      </div>

      {threatFindings.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <p className="text-sm text-emerald-300">Tidak ada ancaman teridentifikasi</p>
          </div>
          <p className="mt-1 text-xs text-emerald-200/70">Arsitektur Anda terlihat aman dari ancaman yang dideteksi.</p>
        </div>
      ) : (
        <>
          {critical.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-300">
                Critical Threats ({critical.length})
              </h3>
              <ul className="space-y-2">
                {critical.map((f, i) => (
                  <FindingItem key={i} finding={f} />
                ))}
              </ul>
            </section>
          )}
          {warnings.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                Warnings ({warnings.length})
              </h3>
              <ul className="space-y-2">
                {warnings.map((f, i) => (
                  <FindingItem key={i} finding={f} />
                ))}
              </ul>
            </section>
          )}
          {info.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Info ({info.length})
              </h3>
              <ul className="space-y-2">
                {info.map((f, i) => (
                  <FindingItem key={i} finding={f} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
