"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { renderEmbedSvg, type EmbedOptions } from "@/lib/embed-svg";
import type { CanvasNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

export default function EmbedPage() {
  const [graphId, setGraphId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [svgCode, setSvgCode] = useState("");
  const [iframeSnippet, setIframeSnippet] = useState("");
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("graph");
    const t = params.get("theme") as "light" | "dark" | null;
    if (id) setGraphId(id);
    if (t) setTheme(t);
  }, []);

  useEffect(() => {
    if (!graphId) return;
    void api.getEmbed(graphId).then((payload) => {
      setName(payload.name);
      setNodes(payload.nodes as Node<CanvasNodeData>[]);
      setEdges(payload.edges as Edge[]);
    });
  }, [graphId]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const result = renderEmbedSvg(nodes, edges, { theme, width: 1400, height: 900 });
    setSvgCode(result.svg);
    setIframeSnippet(result.iframeSnippet);
  }, [nodes, edges, theme]);

  if (!graphId) {
    return <p className="p-8 text-slate-400">Missing ?graph= id</p>;
  }

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-slate-50" : "bg-[#070b10]"}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d1219]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-slate-100">{name || "Embed Diagram"}</h1>
            <p className="text-xs text-slate-500">Graph: {graphId.slice(0, 8)}…</p>
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

      {/* SVG Preview */}
      <div ref={svgRef} className="p-4">
        {svgCode ? (
          <div
            className="rounded-lg border border-white/10 bg-white shadow-lg"
            dangerouslySetInnerHTML={{ __html: svgCode }}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-white/20">
            <p className="text-sm text-slate-500">Carregando diagrama…</p>
          </div>
        )}
      </div>

      {/* Embed Snippet */}
      {iframeSnippet && (
        <div className="border-t border-white/10 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Snippet para embed</p>
          <pre className="rounded bg-[#0d1219] p-3 text-[10px] text-slate-300 overflow-x-auto">
            {iframeSnippet}
          </pre>
          <p className="mt-2 text-[10px] text-slate-500">
            Cole o snippet em Notion, Confluence ou qualquer HTML. O SVG é renderizado inline.
          </p>
        </div>
      )}
    </div>
  );
}
