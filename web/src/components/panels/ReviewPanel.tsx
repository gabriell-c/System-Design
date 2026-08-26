"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Save } from "lucide-react";
import CustomSelect from "@/components/ui/Select";
import PanelEmpty from "@/components/ui/PanelEmpty";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { ReviewStatus, ReviewTemplateItem } from "@/lib/types";

/** ISO 25010 quality characteristics */
const ISO_25010_ATTRIBUTES = [
  { id: "functional_suitability", label: "Adequação Funcional", category: "funcional" },
  { id: "performance_efficiency", label: "Eficiência de Desempenho", category: "funcional" },
  { id: "compatibility", label: "Compatibilidade", category: "funcional" },
  { id: "usability", label: "Usabilidade", category: "usabilidade" },
  { id: "reliability", label: "Confiabilidade", category: "confiabilidade" },
  { id: "security", label: "Segurança", category: "segurança" },
  { id: "maintainability", label: "Manutenibilidade", category: "evolutividade" },
  { id: "testability", label: "Testabilidade", category: "evolutividade" },
  { id: "portability", label: "Portabilidade", category: "evolutividade" },
] as const;

/** ATAM quality scenarios */
const ATAM_SCENARIOS = [
  {
    id: "high_availability",
    label: "Alta Disponibilidade",
    stimulus: "Falha em nó crítico",
    response: "Sistema continua operacional",
    measure: "RTO < 5min, RPO < 1min",
    category: "reliability",
  },
  {
    id: "scalability",
    label: "Escalabilidade",
    stimulus: "Pico de 10x tráfego",
    response: "Auto-scaling ativa",
    measure: "P99 < 500ms sob carga",
    category: "performance",
  },
  {
    id: "security_audit",
    label: "Auditoria de Segurança",
    stimulus: "Tentativa de acesso não autorizado",
    response: "Bloqueio e log de evento",
    measure: "100% das tentativas registradas",
    category: "security",
  },
  {
    id: "data_integrity",
    label: "Integridade de Dados",
    stimulus: "Falha durante transaction",
    response: "Rollback automático",
    measure: "Zero dados corrompidos",
    category: "reliability",
  },
  {
    id: "deployment_speed",
    label: "Velocidade de Deploy",
    stimulus: "Commit em main",
    response: "Deploy em staging em < 10min",
    measure: "CI/CD pipeline verde",
    category: "maintainability",
  },
] as const;

const DEFAULT_CHECKLIST: Omit<ReviewTemplateItem, "checked">[] = [
  { id: "context", label: "Contexto e NFRs preenchidos", required: true },
  { id: "zones", label: "Zonas/regiões representam infra real", required: true },
  { id: "flows", label: "Fluxos numerados e protocolos definidos", required: true },
  { id: "data", label: "Ownership/PII/lineage documentados", required: false },
  { id: "security", label: "Trust boundaries e auth revisados", required: true },
  { id: "ops", label: "Observabilidade e DR considerados", required: false },
  { id: "tradeoffs", label: "Trade-offs explícitos na análise", required: true },
  { id: "iso_quality", label: "Atributos ISO 25010 avaliados", required: false },
  { id: "ata_scenarios", label: "Cenários ATAM mapeados a nós", required: false },
];

/** P1.4.5 — Design review template with mandatory checklist + ISO 25010 + ATAM */
export default function ReviewPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const userRole = useGraphStore((s) => s.userRole);
  const analysis = useGraphStore((s) => s.analysis);
  const nodes = useGraphStore((s) => s.nodes);
  const nfr = useGraphStore((s) => s.nfr);
  const context = useGraphStore((s) => s.context);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("approved");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checklist, setChecklist] = useState<ReviewTemplateItem[]>(
    DEFAULT_CHECKLIST.map((i) => ({ ...i, checked: false })),
  );
  const [isoScores, setIsoScores] = useState<Record<string, number>>({});
  const [ataSelected, setAtaSelected] = useState<string[]>([]);

  const autoHints = useMemo(
    () => ({
      context: Boolean(context.trim() && nfr.users_per_day != null),
      zones: nodes.some((n) => n.data.kind === "zone"),
      flows: nodes.length > 0,
      data: Boolean((nfr.data_ownership?.length ?? 0) > 0 || (nfr.event_topics?.length ?? 0) > 0),
      security: nodes.some((n) => n.data.kind === "identity" || n.data.kind === "security"),
      ops: nodes.some((n) => n.data.kind === "observability"),
      tradeoffs: Boolean((analysis?.trade_offs?.length ?? 0) > 0),
      iso_quality: Object.keys(isoScores).length > 0,
      ata_scenarios: ataSelected.length > 0,
    }),
    [context, nfr, nodes, analysis, isoScores, ataSelected],
  );

  const requiredOk = checklist.filter((c) => c.required).every((c) => c.checked);
  const canApprove = requiredOk && (analysis?.review_scorecard?.review_ready ?? analysis != null);

  if (userRole === "senior") {
    return (
      <div className="px-4 py-4 text-sm text-slate-300 space-y-4">
        <p>
          Perfil <strong>dev sênior</strong>: checklist de design review disponível abaixo.
        </p>
        <ChecklistBlock checklist={checklist} autoHints={autoHints} onToggle={(id) =>
          setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))
        } />
        <IsoQualityBlock scores={isoScores} onChange={setIsoScores} />
        <AtamScenariosBlock scenarios={ataSelected} onChange={setAtaSelected} />
        {analysis ? (
          <p className="text-xs text-emerald-300">Análise disponível — scorecard {analysis.review_scorecard?.overall.toFixed(1) ?? analysis.score.toFixed(1)}</p>
        ) : (
          <PanelEmpty
            icon={ClipboardCheck}
            title="Análise pendente"
            description="Rode uma análise para fechar o ciclo de review."
          />
        )}
      </div>
    );
  }

  if (!graphId) {
    return (
      <PanelEmpty
        icon={Save}
        title="Arquitetura ainda não salva"
        description="Salve a arquitetura antes de solicitar revisão humana."
      />
    );
  }

  async function submit() {
    if (!graphId) return;
    if (status === "approved" && !canApprove) {
      setMessage("Complete o checklist obrigatório antes de aprovar.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.review(graphId, { role: "other", status, comment });
      setMessage("Revisão registrada.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao revisar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3 px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <ChecklistBlock
        checklist={checklist}
        autoHints={autoHints}
        onToggle={(id) => setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))}
      />
      <IsoQualityBlock scores={isoScores} onChange={setIsoScores} />
      <AtamScenariosBlock scenarios={ataSelected} onChange={setAtaSelected} />
      {!requiredOk && <p className="text-xs text-amber-300">Itens obrigatórios pendentes no checklist.</p>}
      <p className="text-sm text-slate-300">Perfil não-sênior: dev sênior aprova após checklist.</p>
      <CustomSelect
        value={status}
        options={[
          { value: "approved", label: "Aprovar" },
          { value: "rejected", label: "Rejeitar" },
          { value: "pending_review", label: "Pedir mais contexto" },
        ]}
        onChange={(value) => setStatus(value as ReviewStatus)}
      />
      <textarea
        id="review-comment"
        className="min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário da revisão"
      />
      <button type="submit" className="btn-primary w-full" disabled={busy || (status === "approved" && !canApprove)}>
        {busy ? "Enviando…" : "Registrar revisão"}
      </button>
      {message && <p className="text-xs text-[var(--muted-fg)]">{message}</p>}
    </form>
  );
}

function ChecklistBlock({
  checklist,
  autoHints,
  onToggle,
}: {
  checklist: ReviewTemplateItem[];
  autoHints: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Design review</p>
      <ul className="mt-2 space-y-2">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggle(item.id)}
              className="mt-0.5"
            />
            <span className={item.required ? "text-slate-200" : "text-[var(--muted-fg)]"}>
              {item.label}
              {item.required && <span className="text-rose-300"> *</span>}
              {autoHints[item.id] && <span className="ml-1 text-emerald-400">· detectado</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IsoQualityBlock({
  scores,
  onChange,
}: {
  scores: Record<string, number>;
  onChange: (s: Record<string, number>) => void;
}) {
  const categories = useMemo(() => {
    type IsoAttr = (typeof ISO_25010_ATTRIBUTES)[number];
    const cats = new Map<string, IsoAttr[]>();
    for (const attr of ISO_25010_ATTRIBUTES) {
      if (!cats.has(attr.category)) cats.set(attr.category, [] as IsoAttr[]);
      cats.get(attr.category)!.push(attr);
    }
    return Array.from(cats.entries());
  }, []);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">ISO 25010 — Qualidade</p>
      <div className="mt-2 space-y-3">
        {categories.map(([cat, attrs]) => (
          <div key={cat}>
            <p className="text-sm font-semibold text-[var(--muted-fg)] uppercase">{cat}</p>
            <div className="mt-1 space-y-1">
              {attrs.map((attr) => (
                <div key={attr.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-slate-300">{attr.label}</span>
                  <select
                    className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-0.5 text-sm text-slate-200"
                    value={scores[attr.id] ?? ""}
                    onChange={(e) => onChange({ ...scores, [attr.id]: Number(e.target.value) })}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AtamScenariosBlock({
  scenarios,
  onChange,
}: {
  scenarios: string[];
  onChange: (s: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(scenarios.includes(id) ? scenarios.filter((s) => s !== id) : [...scenarios, id]);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">ATAM — Cenários de Qualidade</p>
      <div className="mt-2 space-y-2">
        {ATAM_SCENARIOS.map((s) => {
          const selected = scenarios.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`w-full rounded-lg border p-2 text-left transition-colors ${
                selected ? "border-emerald-500/50 bg-emerald-500/10" : "border-[var(--border)] bg-black/20 hover:border-[var(--border-strong)]"
              }`}
              onClick={() => toggle(s.id)}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${selected ? "text-emerald-300" : "text-slate-200"}`}>
                  {s.label}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-sm text-[var(--muted-fg)]">{s.category}</span>
              </div>
              <div className="mt-1 space-y-0.5 text-sm text-[var(--muted-fg)]">
                <p><span className="text-[var(--muted)]">Estímulo:</span> {s.stimulus}</p>
                <p><span className="text-[var(--muted)]">Resposta:</span> {s.response}</p>
                <p><span className="text-[var(--muted)]">Métrica:</span> {s.measure}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {scenarios.length > 0 ? `${scenarios.length} cenários selecionados` : "Nenhum cenário selecionado"}
      </p>
    </div>
  );
}
