"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { CATALOG } from "@/lib/catalog";
import type { CatalogCategory, CatalogItem, NodeKind, UserCatalogPrefs } from "@/lib/types";
import { DEFAULT_CATALOG_PREFS } from "@/lib/types";

const PREFS_KEY = "archia-catalog-prefs";

// ── localStorage helper with SSR safety ──

function readPrefs(): UserCatalogPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_CATALOG_PREFS;
    return { ...DEFAULT_CATALOG_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CATALOG_PREFS;
  }
}

function writePrefs(prefs: UserCatalogPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  notify();
}

// ── Tiny pub/sub so useSyncExternalStore re-renders ──

let listeners: Array<() => void> = [];
function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function notify() {
  for (const cb of listeners) cb();
}
function getSnapshot() {
  try {
    return localStorage.getItem(PREFS_KEY) ?? "";
  } catch {
    return "";
  }
}
function getServerSnapshot() {
  return "";
}

// ── Hook ──

export function useCatalogPrefs() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const prefs: UserCatalogPrefs = useMemo(() => {
    if (!raw) return DEFAULT_CATALOG_PREFS;
    try {
      return { ...DEFAULT_CATALOG_PREFS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CATALOG_PREFS;
    }
  }, [raw]);

  const hasCustomPrefs = prefs.visibleIds.length > 0;

  /** Items that should appear in the palette sidebar */
  const visibleCatalog = useMemo(() => {
    if (!hasCustomPrefs) return CATALOG;
    const set = new Set(prefs.visibleIds);
    return CATALOG.filter((item) => set.has(item.id));
  }, [hasCustomPrefs, prefs.visibleIds]);

  /** Items pinned to the top */
  const pinnedItems = useMemo(() => {
    if (prefs.pinnedIds.length === 0) return [];
    const pinSet = new Set(prefs.pinnedIds);
    return CATALOG.filter((item) => pinSet.has(item.id));
  }, [prefs.pinnedIds]);

  // ── Mutators ──

  const toggleVisible = useCallback((id: string) => {
    const p = readPrefs();
    const set = new Set(p.visibleIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    writePrefs({ ...p, visibleIds: [...set] });
  }, []);

  const setVisible = useCallback((ids: string[]) => {
    const p = readPrefs();
    writePrefs({ ...p, visibleIds: ids });
  }, []);

  const togglePin = useCallback((id: string) => {
    const p = readPrefs();
    const set = new Set(p.pinnedIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    writePrefs({ ...p, pinnedIds: [...set] });
  }, []);

  const addAllOfKind = useCallback((kind: NodeKind) => {
    const p = readPrefs();
    const set = new Set(p.visibleIds);
    for (const item of CATALOG) {
      if (item.kind === kind) set.add(item.id);
    }
    writePrefs({ ...p, visibleIds: [...set] });
  }, []);

  const removeAllOfKind = useCallback((kind: NodeKind) => {
    const p = readPrefs();
    const ids = p.visibleIds.filter((id) => {
      const item = CATALOG.find((c) => c.id === id);
      return item ? item.kind !== kind : true;
    });
    writePrefs({ ...p, visibleIds: ids });
  }, []);

  const addAllOfCategory = useCallback((category: CatalogCategory) => {
    const p = readPrefs();
    const set = new Set(p.visibleIds);
    for (const item of CATALOG) {
      if (item.category === category) set.add(item.id);
    }
    writePrefs({ ...p, visibleIds: [...set] });
  }, []);

  const resetToDefaults = useCallback(() => {
    writePrefs(DEFAULT_CATALOG_PREFS);
  }, []);

  return {
    prefs,
    hasCustomPrefs,
    visibleCatalog,
    pinnedItems,
    toggleVisible,
    setVisible,
    togglePin,
    addAllOfKind,
    removeAllOfKind,
    addAllOfCategory,
    resetToDefaults,
  };
}

// ── Utils for the catalog library panel ──

export type CatalogGroup = {
  kind: NodeKind;
  categories: Array<{
    category: CatalogCategory | "uncategorized";
    items: CatalogItem[];
  }>;
};

const CATEGORY_ORDER: Record<string, number> = {
  language: 0,
  framework: 1,
  library: 2,
  service: 3,
  database: 4,
  platform: 5,
  tool: 6,
  uncategorized: 7,
};

export const CATEGORY_LABELS: Record<string, string> = {
  language: "Linguagens",
  framework: "Frameworks",
  library: "Bibliotecas",
  service: "Serviços",
  database: "Bancos de dados",
  platform: "Plataformas",
  tool: "Ferramentas",
  uncategorized: "Outros",
};

export function groupCatalog(items: CatalogItem[]): CatalogGroup[] {
  const byKind = new Map<NodeKind, Map<string, CatalogItem[]>>();

  for (const item of items) {
    if (!byKind.has(item.kind)) byKind.set(item.kind, new Map());
    const kindMap = byKind.get(item.kind)!;
    const cat = item.category ?? "uncategorized";
    if (!kindMap.has(cat)) kindMap.set(cat, []);
    kindMap.get(cat)!.push(item);
  }

  const result: CatalogGroup[] = [];
  for (const [kind, catMap] of byKind) {
    const categories = [...catMap.entries()]
      .map(([category, items]) => ({
        category: category as CatalogCategory | "uncategorized",
        items: items.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
      }))
      .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));
    result.push({ kind, categories });
  }

  return result;
}
