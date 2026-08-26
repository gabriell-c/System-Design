"use client";

import { ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";
import type { Finding } from "@/lib/types";
import PanelEmpty from "@/components/ui/PanelEmpty";

function severityClass(severity: string): string {
  if (severity === "critical") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-sky-500/40 bg-sky-500/10 text-sky-100";
}

function FindingItem({ finding }: { finding: Finding }) {
  return (
    <li className={`rounded-lg border p-2.5 ${severityClass(finding.severity)}`}>
      <p className="text-xs font-medium">{finding.title}</p>
      <p className="mt-1 text-sm opacity-90">{finding.detail}</p>
      {finding.metric && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-0.5 text-sm uppercase tracking-wide">
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
      <PanelEmpty
        icon={Sparkles}
        title="Ainda sem análise"
        description="Execute a análise para ver ameaças STRIDE e LINDDUN."
      />
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
          <p className="text-sm font-semibold text-slate-100">Análise de ameaças (STRIDE + LINDDUN)</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-fg)]">
            Ameaças de segurança e privacidade detectadas na arquitetura.
          </p>
        </div>
      </div>

      {threatFindings.length === 0 ? (
        <PanelEmpty
          icon={ShieldCheck}
          title="Nenhuma ameaça identificada"
          description="A arquitetura não apresenta ameaças detectáveis pelos checks atuais."
        />
      ) : (
        <>
          {critical.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-300">
                Ameaças críticas ({critical.length})
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
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
                Alertas ({warnings.length})
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
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-300">
                Informações ({info.length})
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
