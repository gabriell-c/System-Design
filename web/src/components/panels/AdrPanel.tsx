"use client";

import { BookMarked, Copy } from "lucide-react";
import { useMemo } from "react";
import { buildAdrs } from "@/lib/adr";
import { useGraphStore } from "@/lib/graph-store";

export default function AdrPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const nfr = useGraphStore((s) => s.nfr);
  const context = useGraphStore((s) => s.context);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  const adrs = useMemo(() => buildAdrs(nodes, nfr, context), [nodes, nfr, context]);

  function copyAll() {
    const md = adrs
      .map(
        (a) =>
          `## ${a.id}: ${a.title}\n\nStatus: ${a.status}\n\n### Contexto\n${a.context}\n\n### Decisão\n${a.decision}\n\n### Consequências\n${a.consequences.map((c) => `- ${c}`).join("\n")}\n`,
      )
      .join("\n");
    void navigator.clipboard.writeText(md).then(() => {
      pushUiNotice({ type: "success", text: "ADRs copiados em Markdown." });
    });
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
            <BookMarked size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">ADRs leves</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Decisões inferidas do canvas e dos NFRs — para colar no repo depois.
            </p>
          </div>
        </div>
        <button type="button" className="btn-ghost inline-flex items-center gap-1 text-[11px]" onClick={copyAll}>
          <Copy size={12} />
          Copiar
        </button>
      </div>

      <ul className="space-y-3">
        {adrs.map((adr) => (
          <li key={adr.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {adr.id} · {adr.status}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-100">{adr.title}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              <span className="text-slate-500">Contexto: </span>
              {adr.context || "—"}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-cyan-100/90">
              <span className="text-slate-500">Decisão: </span>
              {adr.decision}
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-slate-400">
              {adr.consequences.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
