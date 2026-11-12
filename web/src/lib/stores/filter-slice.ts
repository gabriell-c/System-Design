/**
 * P4 — filter/view slice do graph-store (movido VERBATIM de graph-store.ts).
 */
import { saveSavedView } from "../saved-views";
import { VIEW_C4_LEVEL } from "../architecture-view";
import type { ArchitectureView } from "../architecture-view";
import { EMPTY_CANVAS_FILTER } from "../canvas-filter";
import type { C4Level } from "../types";
import type { GraphState } from "./types";
import type { StoreApi } from "zustand";

type SetFn = StoreApi<GraphState>["setState"];
type GetFn = () => GraphState;

export function filterSlice(
  set: SetFn,
  get: GetFn,
): Pick<
  GraphState,
  | "architectureView"
  | "canvasFilter"
  | "savedViewsTick"
  | "focusedZoneId"
  | "highlightNodeIds"
  | "blastUnreachableIds"
  | "blastDegradedIds"
  | "blastHighlightEdgeIds"
  | "blastEdgeIds"
  | "blastLabels"
  | "lastInjection"
  | "diffHighlights"
  | "diagramKind"
  | "parentGraphId"
  | "c4ParentNodeId"
  | "sequenceMode"
  | "setArchitectureView"
  | "setCanvasFilter"
  | "saveView"
  | "loadView"
  | "setFocusedZoneId"
  | "drillDownToView"
  | "setHighlightNodeIds"
  | "setDiffHighlights"
  | "setBlastRadiusHighlight"
  | "clearBlastRadiusHighlight"
  | "setLastInjection"
  | "setSequenceMode"
> {
  return {
  architectureView: "all",
  canvasFilter: EMPTY_CANVAS_FILTER,
  savedViewsTick: 0,
  focusedZoneId: null,
  highlightNodeIds: [],
  blastUnreachableIds: [],
  blastDegradedIds: [],
  blastHighlightEdgeIds: [],
  // S3a: campos SOBRADOS para injeção de falha — `blastHighlightEdgeIds`
  // continua pertencendo ao "Caminho crítico" (analysis-slice).
  blastEdgeIds: [],
  blastLabels: null,
  lastInjection: null,
  diffHighlights: [],
  diagramKind: null,
  parentGraphId: null,
  c4ParentNodeId: null,
  sequenceMode: false,

    setArchitectureView: (architectureView) => set({ architectureView }),

  setCanvasFilter: (canvasFilter) => set({ canvasFilter }),

  saveView: (name, tags) => {
    const { graphId, canvasFilter, savedViewsTick } = get();
    const view = saveSavedView(graphId, { name, tags, filter: canvasFilter });
    set({ savedViewsTick: savedViewsTick + 1 });
    get().pushUiNotice({ type: "success", text: `View "${view.name}" salva.` });
    return view;
  },

  loadView: (view) => {
    set({ canvasFilter: { ...view.filter } });
    get().pushUiNotice({ type: "info", text: `View "${view.name}" aplicada.` });
  },

  setFocusedZoneId: (focusedZoneId) => set({ focusedZoneId }),
  /** P3.1.1 — drill-down para vista 4+1 */

  drillDownToView: (view: ArchitectureView) => {
    set({
      architectureView: view,
      focusedZoneId: null,
      canvasFilter: { ...EMPTY_CANVAS_FILTER, c4Level: (VIEW_C4_LEVEL[view] ?? "all") as C4Level | "all" },
    });
  },

  setHighlightNodeIds: (highlightNodeIds) => set({ highlightNodeIds }),

  // S3a — o estado de blast é AUTOCONTIDO em campos próprios
  // (`blastUnreachableIds`, `blastDegradedIds`, `blastEdgeIds`, `blastLabels`).
  // Ele NÃO escreve `highlightNodeIds` nem `blastHighlightEdgeIds` (ambos
  // pertencem ao "Caminho crítico"/análise, donos no analysis-slice), e
  // `clearBlastRadiusHighlight` abaixo só limpa os campos próprios. Ruling:
  // isolar evita que "Limpar" na aba Falha apague o highlight da Análise.
  setBlastRadiusHighlight: (payload) =>
    set(
      payload
        ? {
            blastUnreachableIds: payload.unreachable,
            blastDegradedIds: payload.degraded,
            blastEdgeIds: payload.edgeIds ?? [],
            blastLabels: payload.labels ?? null,
          }
        : {
            blastUnreachableIds: [],
            blastDegradedIds: [],
            blastEdgeIds: [],
            blastLabels: null,
          },
    ),

  clearBlastRadiusHighlight: () =>
    set({
      blastUnreachableIds: [],
      blastDegradedIds: [],
      blastEdgeIds: [],
      blastLabels: null,
    }),

  setLastInjection: (lastInjection) => set({ lastInjection }),

  setDiffHighlights: (diffHighlights) => set({ diffHighlights }),

  setSequenceMode: (on) => set({ sequenceMode: on }),
  };
}
