"use client";

import { FileDiff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { api } from "@/lib/api";
import { buildDiffHighlights } from "@/lib/diff-highlight";

interface Props {
  graphId: string;
}

export default function DiffPanel({ graphId }: Props) {
  const [versions, setVersions] = useState<Array<{ id: string; name: string; created_at: string }>>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [diffResult, setDiffResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const setDiffHighlights = useGraphStore((s) => s.setDiffHighlights);

  useEffect(() => {
    void api.listVersions(graphId).then(setVersions).catch(() => undefined);
  }, [graphId]);

  const handleCompare = async () => {
    if (!selectedVersion) return;
    setLoading(true);
    try {
      const result = await api.graphDiff(graphId, selectedVersion);
      setDiffResult(result);
      const asIdList = (items: unknown): string[] => {
        if (!Array.isArray(items)) return [];
        return items
          .map((item) => {
            if (item && typeof item === "object" && "id" in item) {
              return String((item as { id: unknown }).id);
            }
            return "";
          })
          .filter(Boolean);
      };
      const highlights = buildDiffHighlights({
        added_node_ids: asIdList(result.added_nodes),
        removed_node_ids: asIdList(result.removed_nodes),
        changed_node_ids: asIdList(result.changed_nodes),
        added_edge_ids: asIdList(result.added_edges),
        removed_edge_ids: asIdList(result.removed_edges),
      });
      setDiffHighlights(highlights);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <FileDiff size={12} className="text-emerald-400" />
        Diff visual
      </div>
      <p className="text-[10px] text-slate-500">
        Compare com uma versão anterior — verde=adicionado, vermelho=removido, amarelo=modificado.
      </p>

      <div className="space-y-2">
        <select
          className="w-full rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-200"
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(e.target.value)}
        >
          <option value="">Selecione uma versão</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({new Date(v.created_at).toLocaleDateString()})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="w-full rounded-md bg-emerald-600/80 px-3 py-1.5 text-[11px] text-white hover:bg-emerald-500 disabled:opacity-50"
          onClick={handleCompare}
          disabled={loading || !selectedVersion}
        >
          <RefreshCw size={11} className="inline mr-1" />
          Comparar versão
        </button>
      </div>

      {diffResult && (
        <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-semibold text-slate-300">Resumo</p>
          <div className="space-y-1 text-[10px] text-slate-400">
            <p><span className="text-emerald-400">●</span> {Array.isArray(diffResult.added_nodes) ? diffResult.added_nodes.length : 0} nós adicionados</p>
            <p><span className="text-rose-400">●</span> {Array.isArray(diffResult.removed_nodes) ? diffResult.removed_nodes.length : 0} nós removidos</p>
            <p><span className="text-amber-400">●</span> {Array.isArray(diffResult.changed_nodes) ? diffResult.changed_nodes.length : 0} nós modificados</p>
            <p><span className="text-emerald-400">→</span> {Array.isArray(diffResult.added_edges) ? diffResult.added_edges.length : 0} arestas adicionadas</p>
            <p><span className="text-rose-400">→</span> {Array.isArray(diffResult.removed_edges) ? diffResult.removed_edges.length : 0} arestas removidas</p>
          </div>
        </div>
      )}
    </div>
  );
}
