"use client";

import type { Edge } from "@xyflow/react";
import { normalizeEdgeData } from "@/lib/edges";

type Props = {
  edges: Edge[];
  nodes: Array<{ id: string; data: { label?: string } }>;
  onSelectEdge?: (edgeId: string) => void;
};

/** P0.1.5 — Vista de sequência a partir de flowNumber. */
export default function SequenceDiagramView({ edges, nodes, onSelectEdge }: Props) {
  const lifelines = [...new Set(edges.flatMap((e) => [e.source, e.target]))];
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;

  const messages = edges
    .map((e) => ({ edge: e, data: normalizeEdgeData(e.data) }))
    .filter(({ data }) => data.flowNumber != null)
    .sort((a, b) => (a.data.flowNumber ?? 0) - (b.data.flowNumber ?? 0));

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1219] p-4 text-xs overflow-x-auto">
      <p className="mb-3 font-semibold text-slate-200">Sequência (request path)</p>
      <div className="flex gap-6 min-w-max pb-2 border-b border-white/10 mb-3">
        {lifelines.map((id) => (
          <div key={id} className="flex flex-col items-center w-28">
            <span className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-slate-200 truncate w-full">
              {labelOf(id)}
            </span>
            <span className="mt-1 h-24 w-px bg-slate-600" />
          </div>
        ))}
      </div>
      <ol className="space-y-2">
        {messages.length === 0 ? (
          <li className="text-slate-500">Conecte nós com fluxos numerados para gerar a sequência.</li>
        ) : (
          messages.map(({ edge, data }) => (
            <li key={edge.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-white/5 px-2 py-1.5 text-left hover:bg-white/5"
                onClick={() => onSelectEdge?.(edge.id)}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                  {data.flowNumber}
                </span>
                <span className="text-slate-300">
                  {labelOf(edge.source)} → {labelOf(edge.target)}
                  {data.label ? ` · ${data.label}` : ""}
                </span>
              </button>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
