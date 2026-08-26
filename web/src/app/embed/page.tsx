"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { renderEmbedSvg } from "@/lib/embed-svg";
import type { CanvasNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

function readEmbedQuery(): { graphId: string | null; theme: "light" | "dark" } {
  if (typeof window === "undefined") return { graphId: null, theme: "dark" };
  const params = new URLSearchParams(window.location.search);
  const id = params.get("graph");
  const t = params.get("theme");
  return {
    graphId: id,
    theme: t === "light" || t === "dark" ? t : "dark",
  };
}

export default function EmbedPage() {
  const initial = useMemo(() => readEmbedQuery(), []);
  const [graphId] = useState<string | null>(initial.graphId);
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(initial.theme);
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    void (async () => {
      const payload = await api.getEmbed(graphId);
      if (cancelled) return;
      setName(payload.name);
      setNodes(payload.nodes as Node<CanvasNodeData>[]);
      setEdges(payload.edges as Edge[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  const embedResult = useMemo(() => {
    if (nodes.length === 0) return { svg: "", iframeSnippet: "" };
    return renderEmbedSvg(nodes, edges, { theme, width: 1400, height: 900 });
  }, [nodes, edges, theme]);

  const svgCode = embedResult.svg;
  const iframeSnippet = embedResult.iframeSnippet;

  if (!graphId) {
    return <p className="p-8 text-[var(--muted-fg)]">Missing ?graph= id</p>;
  }

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-slate-50" : "bg-[var(--background)]"}`}>
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-1)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-slate-100">{name || "Diagrama Incorporado"}</h1>
            <p className="text-xs text-[var(--muted)]">Graph: {graphId.slice(0, 8)}…</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${theme === "light" ? "bg-violet-600 text-white" : "bg-white/10 text-slate-300"}`}
              onClick={() => setTheme("light")}
            >
              Claro
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${theme === "dark" ? "bg-violet-600 text-white" : "bg-white/10 text-slate-300"}`}
              onClick={() => setTheme("dark")}
            >
              Escuro
            </button>
            <button
              type="button"
              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
              onClick={() => {
                navigator.clipboard.writeText(svgCode);
              }}
            >
              Copiar SVG
            </button>
          </div>
        </div>
      </div>

      <div ref={svgRef} className="p-4">
        {svgCode ? (
          <div
            className="rounded-lg border border-[var(--border)] bg-white elev-2"
            dangerouslySetInnerHTML={{ __html: svgCode }}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)]">
            <p className="text-sm text-[var(--muted)]">Carregando diagrama…</p>
          </div>
        )}
      </div>

      {iframeSnippet && (
        <div className="border-t border-[var(--border)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">Snippet para embed</p>
          <pre className="rounded bg-[var(--surface-1)] p-3 text-sm text-slate-300 overflow-x-auto">
            {iframeSnippet}
          </pre>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Cole o snippet em Notion, Confluence ou qualquer HTML. O SVG é renderizado inline.
          </p>
        </div>
      )}
    </div>
  );
}
