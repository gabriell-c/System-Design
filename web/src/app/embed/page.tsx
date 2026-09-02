"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { renderEmbedSvg } from "@/lib/embed-svg";
import type { CanvasNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

type Theme = "light" | "dark";

export default function EmbedPage() {
  const [graphId, setGraphId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<HTMLDivElement>(null);

  // Read URL params after mount (avoid hydration mismatch)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("graph");
    const t = params.get("theme");
    if (id) setGraphId(id);
    if (t === "light" || t === "dark") setTheme(t);
    if (!id) setLoading(false);
  }, []);

  useEffect(() => {
    if (!graphId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const payload = await api.getEmbed(graphId);
        if (cancelled) return;
        setName(payload.name);
        setNodes(payload.nodes as Node<CanvasNodeData>[]);
        setEdges(payload.edges as Edge[]);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar diagrama");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://archia.local";

  const embedResult = useMemo(() => {
    if (nodes.length === 0) {
      return {
        svg: "",
        iframeSnippet: graphId
          ? `<iframe src="${origin}/embed?graph=${graphId}&theme=${theme}" width="100%" height="600" frameborder="0" title="Archia diagram" loading="lazy"></iframe>`
          : "",
      };
    }
    const result = renderEmbedSvg(nodes, edges, { theme, width: 1400, height: 900 });
    const liveUrl = `${origin}/embed?graph=${graphId}&theme=${theme}`;
    const svgApi = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410"}/api/v1/embed/${graphId}/svg?theme=${theme}`;
    return {
      ...result,
      iframeSnippet: `<iframe src="${liveUrl}" width="100%" height="600" frameborder="0" title="Archia — ${name || "diagrama"}" loading="lazy" allowfullscreen></iframe>\n<!-- SVG estático: ${svgApi} -->`,
    };
  }, [nodes, edges, theme, graphId, name, origin]);

  const svgCode = embedResult.svg;
  const iframeSnippet = embedResult.iframeSnippet;

  if (!graphId && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-[var(--muted-fg)]">
          Informe o parâmetro <code className="rounded bg-white/5 px-1">?graph=ID</code> na URL.
        </p>
      </div>
    );
  }

  const isLight = theme === "light";

  return (
    <div className={`min-h-screen ${isLight ? "bg-slate-50 text-slate-900" : "bg-[var(--background)] text-[var(--foreground)]"}`}>
      <div
        className={`sticky top-0 z-10 border-b px-4 py-3 backdrop-blur ${
          isLight ? "border-slate-200 bg-white/95" : "border-[var(--border)] bg-[var(--surface-1)]/95"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={`text-sm font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>
              {name || "Diagrama Incorporado"}
            </h1>
            <p className={`text-xs ${isLight ? "text-slate-500" : "text-[var(--muted)]"}`}>
              Embed vivo · {graphId ? `${graphId.slice(0, 8)}…` : "…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${theme === "light" ? "bg-indigo-600 text-white" : isLight ? "bg-slate-100 text-slate-700" : "bg-white/10 text-slate-300"}`}
              onClick={() => setTheme("light")}
            >
              Claro
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${theme === "dark" ? "bg-indigo-600 text-white" : isLight ? "bg-slate-100 text-slate-700" : "bg-white/10 text-slate-300"}`}
              onClick={() => setTheme("dark")}
            >
              Escuro
            </button>
            <button
              type="button"
              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
              disabled={!svgCode}
              onClick={() => {
                void navigator.clipboard.writeText(svgCode);
              }}
            >
              Copiar SVG
            </button>
          </div>
        </div>
      </div>

      <div ref={svgRef} className="p-4">
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        ) : loading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)]">
            <p className="text-sm text-[var(--muted)]">Carregando diagrama…</p>
          </div>
        ) : svgCode ? (
          <div
            className={`overflow-auto rounded-lg border elev-2 ${isLight ? "border-slate-200 bg-white" : "border-[var(--border)] bg-[var(--surface-1)]"}`}
            dangerouslySetInnerHTML={{ __html: svgCode }}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)]">
            <p className="text-sm text-[var(--muted)]">Diagrama vazio.</p>
          </div>
        )}
      </div>

      {iframeSnippet && (
        <div className={`border-t p-4 ${isLight ? "border-slate-200" : "border-[var(--border)]"}`}>
          <p className={`mb-2 text-xs font-semibold uppercase ${isLight ? "text-slate-500" : "text-[var(--muted)]"}`}>
            Snippet para Notion / Confluence
          </p>
          <pre
            className={`overflow-x-auto rounded p-3 text-sm ${
              isLight ? "bg-slate-100 text-slate-700" : "bg-[var(--surface-1)] text-slate-300"
            }`}
          >
            {iframeSnippet}
          </pre>
          <p className={`mt-2 text-sm ${isLight ? "text-slate-500" : "text-[var(--muted)]"}`}>
            O iframe aponta para o embed vivo (SVG regenerado a cada carga). Use o endpoint{" "}
            <code className="rounded bg-black/5 px-1">/api/v1/embed/&#123;id&#125;/svg</code> para SVG estático.
          </p>
        </div>
      )}
    </div>
  );
}
