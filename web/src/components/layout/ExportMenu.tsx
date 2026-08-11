"use client";

import {
  Download,
  FileImage,
  FileJson,
  FileText,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  downloadJson,
  downloadText,
  slugifyFilename,
  toArchitectureMarkdown,
  toExportPayload,
} from "@/lib/export";
import { exportArchitecturePdf, exportArchitecturePng } from "@/lib/export-canvas";
import { useGraphStore } from "@/lib/graph-store";

type Props = {
  onDone?: () => void;
};

export default function ExportMenu({ onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const name = useGraphStore((s) => s.name);
  const context = useGraphStore((s) => s.context);
  const nfr = useGraphStore((s) => s.nfr);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const analysis = useGraphStore((s) => s.analysis);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const base = slugifyFilename(name);

  async function run(kind: "json" | "md" | "png" | "pdf") {
    try {
      if (kind === "json") {
        downloadJson(
          `${base}.graph.json`,
          toExportPayload(name, nodes, edges, analysis, context, nfr),
        );
        pushUiNotice({ type: "success", text: "JSON exportado (reimportável)." });
      } else if (kind === "md") {
        const md = toArchitectureMarkdown(name, nodes, edges, { context, nfr, analysis });
        downloadText(`${base}.md`, md, "text/markdown;charset=utf-8");
        pushUiNotice({ type: "success", text: "Markdown exportado." });
      } else if (kind === "png") {
        setBusy("png");
        await exportArchitecturePng(`${base}.png`, nodes);
        pushUiNotice({ type: "success", text: "Imagem PNG exportada." });
      } else {
        setBusy("pdf");
        await exportArchitecturePdf(name, nodes, edges, { context, nfr, analysis, includeDiagram: true });
        pushUiNotice({
          type: "success",
          text: "PDF: escolha “Salvar como PDF” na impressão.",
        });
      }
      setOpen(false);
      onDone?.();
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha ao exportar",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost inline-flex items-center gap-1.5"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy != null}
        onClick={() => setOpen((v) => !v)}
        title="Exportar arquitetura (JSON, PNG, Markdown, PDF)"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        <span className="hidden md:inline">Exportar</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-60 rounded-xl border border-white/10 bg-[#121821] p-1 shadow-2xl"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Baixar arquitetura
          </p>
          <ExportItem
            icon={<FileJson size={14} />}
            label="JSON"
            hint="Reimportável no editor"
            onClick={() => void run("json")}
          />
          <ExportItem
            icon={<FileImage size={14} />}
            label="Imagem PNG"
            hint="Diagrama do canvas"
            disabled={nodes.length === 0 || busy != null}
            onClick={() => void run("png")}
          />
          <ExportItem
            icon={<FileText size={14} />}
            label="Markdown"
            hint="Doc para README / PR"
            onClick={() => void run("md")}
          />
          <ExportItem
            icon={<Download size={14} />}
            label="PDF"
            hint="Impressão → Salvar como PDF"
            disabled={busy != null}
            onClick={() => void run("pdf")}
          />
        </div>
      )}
    </div>
  );
}

function ExportItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/5 disabled:opacity-40"
      onClick={onClick}
    >
      <span className="mt-0.5 text-slate-300">{icon}</span>
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
