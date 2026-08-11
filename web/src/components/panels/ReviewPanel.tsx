"use client";

import { useState } from "react";
import CustomSelect from "@/components/ui/Select";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { ReviewStatus } from "@/lib/types";

export default function ReviewPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const userRole = useGraphStore((s) => s.userRole);
  const analysis = useGraphStore((s) => s.analysis);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("approved");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (userRole === "senior") {
    return (
      <div className="px-4 py-4 text-sm text-slate-300">
        Perfil <strong>dev sênior</strong>: a análise da IA/heurística já vale como aprovação.
        Não é necessário checkpoint extra.
        {analysis ? (
          <p className="mt-3 text-xs text-emerald-300">Arquitetura considerada aprovada para este perfil.</p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Rode uma análise para fechar o ciclo.</p>
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
      <p className="text-sm text-slate-300">
        Perfil não-sênior: um dev sênior precisa aprovar antes da arquitetura ser considerada fechada.
      </p>
      <label className="block text-xs uppercase tracking-wide text-slate-500">
        Decisão
      </label>
      <CustomSelect
        value={status}
        options={[
          { value: "approved", label: "Aprovar" },
          { value: "rejected", label: "Rejeitar" },
          { value: "pending_review", label: "Pedir mais contexto" },
        ]}
        onChange={(value) => setStatus(value as ReviewStatus)}
      />
      <label className="block text-xs uppercase tracking-wide text-slate-500" htmlFor="review-comment">
        Comentário
      </label>
      <textarea
        id="review-comment"
        required
        minLength={8}
        rows={5}
        className="w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Riscos, trade-offs, o que falta validar…"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Registrar revisão"}
      </button>
      {message && <p className="text-xs text-slate-400">{message}</p>}
    </form>
  );
}
