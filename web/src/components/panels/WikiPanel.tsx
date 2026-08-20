"use client";

import { BookOpen, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import { downloadText, slugifyFilename } from "@/lib/export";

export default function WikiPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const name = useGraphStore((s) => s.name);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const doc = await api.liveDoc(graphId);
        if (cancelled) return;
        setMarkdown(doc.markdown);
        setUpdatedAt(doc.updated_at);
      } catch {
        if (!cancelled) setMarkdown("_Erro ao carregar wiki viva._");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId, name]);

  async function copyMd() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!graphId) {
    return <p className="px-4 py-6 text-sm text-slate-500">Salve o diagrama para gerar a wiki.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Gerando documentação…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <BookOpen size={16} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Wiki viva</p>
            <p className="text-[10px] text-slate-500">Atualizado: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost text-[10px]" onClick={() => void copyMd()}>
            <Copy size={12} className="mr-1 inline" />
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            className="btn-ghost text-[10px]"
            onClick={() => downloadText(`${slugifyFilename(name)}-wiki.md`, markdown, "text/markdown")}
          >
            .md
          </button>
        </div>
      </div>
      <pre className="custom-scroll mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
        {markdown}
      </pre>
    </div>
  );
}
