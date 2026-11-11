/**
 * P4 — analysis slice do graph-store (movido VERBATIM de graph-store.ts).
 */
import { computeCriticalPath } from "../critical-path";
import { api } from "../api";
import { scheduleClearNotice } from "./helpers";
import type { GraphState } from "./types";
import type { StoreApi } from "zustand";

type SetFn = StoreApi<GraphState>["setState"];
type GetFn = () => GraphState;

export function analysisSlice(
  set: SetFn,
  get: GetFn,
): Pick<
  GraphState,
  | "analysis"
  | "analyzing"
  | "analyzeError"
  | "recommendations"
  | "runAnalyze"
  | "setAnalysis"
  | "setAnalyzing"
  | "highlightCriticalPath"
  | "clearCriticalPathHighlight"
  | "dismissRecommendations"
> {
  return {
  analysis: null,
  analyzing: false,
  analyzeError: null,
  recommendations: [],

    dismissRecommendations: () => {
    set({ recommendations: [] });
  },

  highlightCriticalPath: () => {
    const { edgeIds, nodeIds } = computeCriticalPath(get().nodes, get().edges);
    set({
      highlightNodeIds: nodeIds,
      blastHighlightEdgeIds: edgeIds,
      uiNotice: { type: "info", text: `Caminho crítico: ${nodeIds.length} nós, ${edgeIds.length} arestas.` },
    });
    scheduleClearNotice(set);
  },

  clearCriticalPathHighlight: () => {
    set({ highlightNodeIds: [], blastHighlightEdgeIds: [] });
  },

  runAnalyze: async () => {
    // Mesma via do botão "Analisar" da TopBar (EditorShell#runAnalyze):
    // api.analyze com o estado atual do store + updates nos mesmos campos.
    const { name, context, nfr, nodes, edges, graphId } = get();
    if (nodes.length === 0) return;
    set({ analyzing: true, analyzeError: null });
    try {
      const result = await api.analyze({ name, context, nfr, nodes, edges, persist_id: graphId });
      get().setAnalysis(result);
      get().setAnalyzing(false);
      get().pushUiNotice({
        type: "success",
        text: `Análise pronta (${result.ia_ok ? "com IA" : "heurística local"}) · nota ${result.score.toFixed(1)}. Veja a aba Análise.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na análise";
      get().setAnalyzing(false, msg);
      get().pushUiNotice({ type: "error", text: msg });
    }
  },

  setAnalysis: (analysis) => {
    const criticalIds = analysis?.score_breakdown?.critical_node_ids ?? [];
    const nodes = get().nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        score: analysis?.node_scores?.[node.id] ?? null,
        summary: analysis?.findings.find((f) => f.node_id === node.id)?.title,
        bottleneck: Boolean(
          analysis?.findings.some(
            (f) => f.node_id === node.id && (f.severity === "warning" || f.severity === "critical"),
          ),
        ),
      },
    }));
    set({ nodes, analysis, analyzeError: null, highlightNodeIds: criticalIds });
  },

  setAnalyzing: (analyzing, error = null) => set({ analyzing, analyzeError: error }),
  };
}
