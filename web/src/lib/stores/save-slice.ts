/**
 * P4 — save slice do graph-store (movido VERBATIM de graph-store.ts).
 */
import type { GraphState } from "./types";
import type { StoreApi } from "zustand";

type SetFn = StoreApi<GraphState>["setState"];

export function saveSlice(
  set: SetFn,
): Pick<
  GraphState,
  | "dirty"
  | "lastSavedAt"
  | "isLocked"
  | "lastEtag"
  | "saveStatus"
  | "setIsLocked"
  | "setLastEtag"
  | "setSaveStatus"
  | "markSaved"
> {
  return {
  dirty: false,
  lastSavedAt: null,
  isLocked: false,
  lastEtag: null,
  saveStatus: "saved",

    setIsLocked: (locked) => set({ isLocked: locked }),

  setLastEtag: (etag) => set({ lastEtag: etag }),

  setSaveStatus: (status) => set({ saveStatus: status }),

  markSaved: (id, etag = null) =>
    set({
      graphId: id,
      dirty: false,
      lastSavedAt: new Date().toISOString(),
      lastEtag: etag,
      saveStatus: "saved",
    }),
  };
}
