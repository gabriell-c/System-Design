"use client";

import { useMemo, useState } from "react";
import CustomSelect from "@/components/ui/Select";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { ReviewStatus, ReviewTemplateItem } from "@/lib/types";

const DEFAULT_CHECKLIST: Omit<ReviewTemplateItem, "checked">[] = [
  { id: "context", label: "Contexto e NFRs preenchidos", required: true },
  { id: "zones", label: "Zonas/regiões representam infra real", required: true },
  { id: "flows", label: "Fluxos numerados e protocolos definidos", required: true },
  { id: "data", label: "Ownership/PII/lineage documentados", required: false },
  { id: "security", label: "Trust boundaries e auth revisados", required: true },
  { id: "ops", label: "Observabilidade e DR considerados", required: false },
  { id: "tradeoffs", label: "Trade-offs explícitos na análise", required: true },
];

/** P1.4.5 — Design review template with mandatory checklist */
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

  const autoHints = useMemo(
    () => ({
      context: Boolean(context.trim() && nfr.users_per_day != null),
      zones: nodes.some((n) => n.data.kind === "zone"),
      flows: nodes.length > 0,
      data: Boolean((nfr.data_ownership?.length ?? 0) > 0 || (nfr.event_topics?.length ?? 0) > 0),
      security: nodes.some((n) => n.data.kind === "identity" || n.data.kind === "security"),
      ops: nodes.some((n) => n.data.kind === "observability"),
      tradeoffs: Boolean((analysis?.trade_offs?.length ?? 0) > 0),
    }),
    [context, nfr, nodes, analysis],
  );

  const requiredOk = checklist.filter((c) => c.required).every((c) => c.checked);
  const canApprove = requiredOk && (analysis?.review_scorecard?.review_ready ?? analysis != null);

  if (userRole === "senior") {
    return (
      <div className="px-4 py-4 text-sm text-slate-300 space-y-3">
        <p>
          Perfil <strong>dev sênior</strong>: checklist de design review disponível abaixo.
        </p>
        <ChecklistBlock checklist={checklist} autoHints={autoHints} onToggle={(id) =>
          setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))
        } />
        {analysis ? (
          <p className="text-xs text-emerald-300">Análise disponível — scorecard {analysis.review_scorecard?.overall.toFixed(1) ?? analysis.score.toFixed(1)}</p>
        ) : (
          <p className="text-xs text-slate-500">Rode uma análise para fechar o ciclo.</p>
        )}
      </div>
    );
  }

  if (!graphId) {
    return (
      <p className="px-4 py-4 text-sm text-slate-400">
        Salve a arquitetura antes de solicitar revisão humana.
      </p>
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
        className="min-h-[80px] w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário da revisão"
      />
      <button type="submit" className="btn-primary w-full" disabled={busy || (status === "approved" && !canApprove)}>
        {busy ? "Enviando…" : "Registrar revisão"}
      </button>
      {message && <p className="text-xs text-slate-400">{message}</p>}
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
    <div className="rounded-xl border border-white/10 bg-[#0d1219] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Design review</p>
      <ul className="mt-2 space-y-2">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggle(item.id)}
              className="mt-0.5"
            />
            <span className={item.required ? "text-slate-200" : "text-slate-400"}>
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
