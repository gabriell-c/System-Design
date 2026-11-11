/**
 * P4 — analysis slice do graph-store (movido VERBATIM de graph-store.ts).
 */
import { computeCriticalPath } from "../critical-path";
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
  | "analyzePhase"
  | "setAnalyzePhase"
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
  analyzePhase: "idle",

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

  setAnalyzePhase: (phase) => set({ analyzePhase: phase }),

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
