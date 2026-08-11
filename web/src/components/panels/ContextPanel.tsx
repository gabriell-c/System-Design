"use client";

import { FileText, Lightbulb, LayoutTemplate } from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { COMPLIANCE_OPTIONS } from "@/lib/nfr";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { useGraphStore } from "@/lib/graph-store";

const PLACEHOLDER = `Ex.: SaaS de agendamento para clínicas odontológicas.
Público: secretárias e dentistas no Brasil.
Escala inicial: ~2k usuários ativos / dia.
Restrições: LGPD, hospedagem barata no início, time de 2 devs.
Objetivo: MVP em 8 semanas com login, agenda e WhatsApp.`;

export default function ContextPanel() {
  const context = useGraphStore((s) => s.context);
  const setContext = useGraphStore((s) => s.setContext);
  const nfr = useGraphStore((s) => s.nfr);
  const setNfr = useGraphStore((s) => s.setNfr);
  const applyTemplate = useGraphStore((s) => s.applyTemplate);
  const dirty = useGraphStore((s) => s.dirty);
  const nodes = useGraphStore((s) => s.nodes);
  const { confirm, dialog } = useConfirmDialog();

  async function useTemplate(id: string) {
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (dirty || nodes.length > 0) {
      const ok = await confirm({
        title: `Aplicar template “${tpl.label}”?`,
        description: "Isso substitui o canvas, o brief e os NFRs atuais pelo modelo do template.",
        consequences: "Alterações não salvas no desenho atual serão perdidas (Ctrl+Z desfaz).",
        confirmLabel: "Aplicar template",
        tone: "danger",
      });
      if (!ok) return;
    }
    applyTemplate(tpl);
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {dialog}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
          <FileText size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Contexto e NFRs</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Brief livre + restrições mensuráveis. A análise e o checklist de kickoff usam os dois.
          </p>
        </div>
      </div>

      <section>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
          <LayoutTemplate size={12} />
          Templates de projeto
        </p>
        <ul className="grid gap-1.5">
          {PROJECT_TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.03]"
                onClick={() => void useTemplate(tpl.id)}
              >
                <span className="block text-sm font-medium text-slate-100">{tpl.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{tpl.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="project-context">
          Brief
        </label>
        <textarea
          id="project-context"
          className="mt-1 min-h-[140px] w-full resize-y rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none focus:border-cyan-400/50"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck
        />
        <p className="mt-1 text-[11px] text-slate-500">{context.trim().length} caracteres</p>
      </div>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">NFRs estruturados</p>
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="Usuários / dia"
            value={nfr.users_per_day}
            onChange={(v) => setNfr({ ...nfr, users_per_day: v })}
          />
          <NumField
            label="Budget US$/mês"
            value={nfr.budget_usd_month}
            onChange={(v) => setNfr({ ...nfr, budget_usd_month: v })}
          />
          <NumField
            label="Disponibilidade %"
            value={nfr.availability_pct}
            onChange={(v) => setNfr({ ...nfr, availability_pct: v })}
          />
          <NumField
            label="Latência p99 (ms)"
            value={nfr.latency_p99_ms}
            onChange={(v) => setNfr({ ...nfr, latency_p99_ms: v })}
          />
          <NumField label="Time (pessoas)" value={nfr.team_size} onChange={(v) => setNfr({ ...nfr, team_size: v })} />
          <NumField
            label="Prazo (semanas)"
            value={nfr.deadline_weeks}
            onChange={(v) => setNfr({ ...nfr, deadline_weeks: v })}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] text-slate-500">Compliance</p>
          <div className="flex flex-wrap gap-1.5">
            {COMPLIANCE_OPTIONS.map((opt) => {
              const on = nfr.compliance.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    on
                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                  onClick={() =>
                    setNfr({
                      ...nfr,
                      compliance: on ? nfr.compliance.filter((c) => c !== opt) : [...nfr.compliance, opt],
                    })
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Caminho até produção</p>
          {(
            [
              ["has_dev", "Ambiente de desenvolvimento"],
              ["has_staging", "Staging / homologação"],
              ["has_prod", "Produção"],
              ["has_ci_cd", "CI/CD"],
              ["has_backups", "Backups"],
              ["has_monitoring_plan", "Plano de monitoramento"],
            ] as const
          ).map(([key, label]) => (
            <Toggle
              key={key}
              checked={nfr.environments[key]}
              onChange={(checked) =>
                setNfr({
                  ...nfr,
                  environments: { ...nfr.environments, [key]: checked },
                })
              }
              label={<span className="text-xs">{label}</span>}
              className="py-1.5"
            />
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
        <p className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
          <Lightbulb size={12} className="text-amber-300" />
          Dica
        </p>
        Depois do brief, abra a aba <strong className="text-slate-300">Kickoff</strong> para ver o que ainda falta
        (auth, obs, ambientes…).
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block text-[11px] text-slate-500">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(null);
          else onChange(Number(raw));
        }}
      />
    </label>
  );
}
