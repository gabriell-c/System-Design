import type { CanvasFilter } from "./canvas-filter";
import type { SavedView } from "./types";

const DEFAULT_FILTER: CanvasFilter = {
  query: "",
  kind: "all",
  zoneKind: "all",
  provider: "all",
  layerView: "all",
  ownerTeam: "",
  catalogId: "",
  piiSensitivity: "all",
  c4Level: "all",
};

const STORAGE_PREFIX = "archia-saved-views";

function storageKey(graphId: string | null): string {
  return `${STORAGE_PREFIX}:${graphId ?? "draft"}`;
}

function normalizeFilter(raw: Partial<CanvasFilter> | undefined): CanvasFilter {
  return {
    ...DEFAULT_FILTER,
    ...(raw ?? {}),
    piiSensitivity: raw?.piiSensitivity ?? "all",
    c4Level: raw?.c4Level ?? "all",
  };
}

function parseViews(raw: string | null): SavedView[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => ({
      ...v,
      tags: Array.isArray(v.tags) ? v.tags : [],
      filter: normalizeFilter(v.filter),
    }));
  } catch {
    return [];
  }
}

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function listSavedViews(graphId: string | null): SavedView[] {
  if (!hasStorage()) return [];
  try {
    return parseViews(localStorage.getItem(storageKey(graphId)));
  } catch {
    return [];
  }
}

export function saveSavedView(
  graphId: string | null,
  input: { name: string; tags?: string[]; filter: CanvasFilter },
): SavedView {
  const now = new Date().toISOString();
  const view: SavedView = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    filter: normalizeFilter(input.filter),
    created_at: now,
    updated_at: now,
  };
  const existing = listSavedViews(graphId);
  const next = [view, ...existing];
  localStorage.setItem(storageKey(graphId), JSON.stringify(next));
  return view;
}

export function deleteSavedView(graphId: string | null, viewId: string): boolean {
  const existing = listSavedViews(graphId);
  const next = existing.filter((v) => v.id !== viewId);
  if (next.length === existing.length) return false;
  localStorage.setItem(storageKey(graphId), JSON.stringify(next));
  return true;
}

export function updateSavedView(
  graphId: string | null,
  viewId: string,
  patch: Partial<Pick<SavedView, "name" | "tags" | "filter">>,
): SavedView | null {
  const existing = listSavedViews(graphId);
  let updated: SavedView | null = null;
  const next = existing.map((v) => {
    if (v.id !== viewId) return v;
    updated = {
      ...v,
      ...patch,
      name: patch.name?.trim() ?? v.name,
      tags: patch.tags ?? v.tags,
      filter: patch.filter ? normalizeFilter(patch.filter) : v.filter,
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  if (!updated) return null;
  localStorage.setItem(storageKey(graphId), JSON.stringify(next));
  return updated;
}
