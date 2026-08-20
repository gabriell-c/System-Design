"use client";

import { X } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";

export default function DomainNotice() {
  const uiNotice = useGraphStore((s) => s.uiNotice);
  const clearUiNotice = useGraphStore((s) => s.clearUiNotice);

  if (!uiNotice) return null;

  const tone =
    uiNotice.type === "error"
      ? "border-rose-400/50 bg-rose-950 text-rose-50"
      : uiNotice.type === "success"
        ? "border-emerald-400/50 bg-emerald-950 text-emerald-50"
        : "border-cyan-400/50 bg-slate-950 text-slate-100";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto fixed left-1/2 top-4 z-[200] flex max-w-lg -translate-x-1/2 items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl ${tone}`}
    >
      <p className="min-w-0 flex-1 leading-snug">{uiNotice.text}</p>
      <button
        type="button"
        aria-label="Fechar aviso"
        className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
        onClick={() => clearUiNotice()}
      >
        <X size={14} />
      </button>
    </div>
  );
}
