/**
 * P4 — UI slice do graph-store (movido VERBATIM de graph-store.ts).
 */
import { scheduleClearNotice } from "./helpers";
import type { GraphState } from "./types";
import type { StoreApi } from "zustand";

type SetFn = StoreApi<GraphState>["setState"];

export function uiSlice(
  set: SetFn,
): Pick<
  GraphState,
  | "uiNotice"
  | "userRole"
  | "ownerTeam"
  | "canvasComments"
  | "setOwnerTeam"
  | "setCanvasComments"
  | "setUserRole"
  | "clearUiNotice"
  | "pushUiNotice"
> {
  return {
  uiNotice: null,
  userRole: "senior",
  ownerTeam: "",
  canvasComments: [],

    setOwnerTeam: (ownerTeam) => set({ ownerTeam, dirty: true }),

  setCanvasComments: (canvasComments) => set({ canvasComments }),

  setUserRole: (userRole) => set({ userRole }),

  clearUiNotice: () => set({ uiNotice: null }),

  pushUiNotice: (notice) => {
    set({ uiNotice: notice });
    scheduleClearNotice(set);
  },
  };
}
