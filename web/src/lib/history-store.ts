"use client";

/**
 * Global undo/redo facade over graph-store (T6).
 * Persists past/future to sessionStorage so history survives remounts
 * and free ↔ structured UI mode switches without clearing the stack.
 */
import { useGraphStore, type GraphSnapshot } from "./graph-store";

const STORAGE_PREFIX = "archia-history:";

type PersistedHistory = {
  graphId: string | null;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
};

function storageKey(graphId: string | null): string {
  return `${STORAGE_PREFIX}${graphId ?? "local"}`;
}

export function persistHistory(): void {
  const { graphId, past, future } = useGraphStore.getState();
  try {
    const payload: PersistedHistory = { graphId, past, future };
    sessionStorage.setItem(storageKey(graphId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function restoreHistory(graphId: string | null): boolean {
  try {
    const raw = sessionStorage.getItem(storageKey(graphId));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as PersistedHistory;
    if (!parsed || !Array.isArray(parsed.past) || !Array.isArray(parsed.future)) return false;
    useGraphStore.setState({
      past: parsed.past.slice(-80),
      future: parsed.future.slice(0, 80),
    });
    return true;
  } catch {
    return false;
  }
}

export function undo(): boolean {
  const ok = useGraphStore.getState().undo();
  if (ok) persistHistory();
  return ok;
}

export function redo(): boolean {
  const ok = useGraphStore.getState().redo();
  if (ok) persistHistory();
  return ok;
}

export function canUndo(): boolean {
  return useGraphStore.getState().canUndo();
}

export function canRedo(): boolean {
  return useGraphStore.getState().canRedo();
}

/** Hook-friendly selectors — subscribe to graph-store past/future lengths. */
export function useHistoryStore() {
  const pastLen = useGraphStore((s) => s.past.length);
  const futureLen = useGraphStore((s) => s.future.length);
  return {
    pastLength: pastLen,
    futureLength: futureLen,
    canUndo: pastLen > 0,
    canRedo: futureLen > 0,
    undo,
    redo,
    persistHistory,
    restoreHistory,
  };
}

/** Call after withHistory mutations — wire from graph-store subscribers. */
let subscribed = false;
export function ensureHistoryPersistence(): void {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  useGraphStore.subscribe((state, prev) => {
    if (state.past !== prev.past || state.future !== prev.future) {
      persistHistory();
    }
    if (state.graphId && state.graphId !== prev.graphId) {
      restoreHistory(state.graphId);
    }
  });
}
