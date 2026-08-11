"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { parseImportPayload, type GraphExport } from "@/lib/export";
import type { AnalysisResult } from "@/lib/types";

export default function CompareView() {
  const [left, setLeft] = useState<GraphExport | null>(null);
  const [right, setRight] = useState<GraphExport | null>(null);
  const [result, setResult] = useState<{
    left: AnalysisResult;
    right: AnalysisResult;
    comparison: { score_delta: number; cheaper: string; simpler: string; notes: string[] };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCompare = left && right;

  async function run() {
    if (!left || !right) return;
    setBusy(true);
    setError(null);
    try {
      const compared = await api.compare(
        { name: left.name, nodes: left.nodes, edges: left.edges },
        { name: right.name, nodes: right.nodes, edges: right.edges },
      );
      setResult(compared);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao comparar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Comparador de arquiteturas</h1>
          <p className="mt-1 text-sm text-slate-400">
            Importe dois exports JSON e compare custo, complexidade, performance e segurança.
          </p>
        </div>
        <Link href="/" className="btn-ghost">
          Voltar ao editor
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ImportSlot title="Arquitetura A" value={left} onLoad={setLeft} />
        <ImportSlot title="Arquitetura B" value={right} onLoad={setRight} />
      </div>
      <button
        type="button"
        disabled={!canCompare || busy}
        onClick={() => void run()}
        className="self-start rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
      >
        {busy ? "Comparando…" : "Comparar"}
      </button>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#121821] p-4">
            <p className="text-sm text-slate-300">
              Delta de nota: <strong className="text-slate-50">{result.comparison.score_delta.toFixed(1)}</strong>
              {" · "}Mais barata (heurística): {result.comparison.cheaper}
              {" · "}Mais simples: {result.comparison.simpler}
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-300">
              {result.comparison.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ResultCard title={left?.name ?? "A"} analysis={result.left} />
            <ResultCard title={right?.name ?? "B"} analysis={result.right} />
          </div>
        </div>
      )}
    </div>
  );
}

function ImportSlot({
  title,
  value,
  onLoad,
}: {
  title: string;
  value: GraphExport | null;
  onLoad: (payload: GraphExport) => void;
}) {
  const summary = useMemo(() => {
    if (!value) return null;
    return `${value.nodes.length} nodes · ${value.edges.length} conexões`;
  }, [value]);

  return (
    <label className="flex cursor-pointer flex-col rounded-xl border border-dashed border-white/15 bg-[#121821] p-4">
      <span className="text-sm font-medium text-slate-100">{title}</span>
      <span className="mt-1 text-xs text-slate-500">{value ? `${value.name} — ${summary}` : "Clique para importar .json"}</span>
      <input
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          onLoad(parseImportPayload(JSON.parse(await file.text())));
        }}
      />
    </label>
  );
}

function ResultCard({ title, analysis }: { title: string; analysis: AnalysisResult }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#121821] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <span className="text-2xl font-semibold tabular-nums text-slate-50">{analysis.score.toFixed(1)}</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{analysis.summary}</p>
      <ul className="mt-3 space-y-1 text-xs text-slate-400">
        {analysis.risks.slice(0, 4).map((risk) => (
          <li key={risk}>• {risk}</li>
        ))}
      </ul>
    </article>
  );
}
