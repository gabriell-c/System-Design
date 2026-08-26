/** Local draft persistence for auto-save fallback (localStorage + IndexedDB). */

import type { Edge, Node } from "@xyflow/react";
import type { AnalysisResult, CanvasNodeData, ProjectNfr } from "./types";

export const LOCAL_DRAFT_KEY = "archia-draft";
export const DB_NAME = "archia-local";
export const STORE_NAME = "drafts";

export type LocalDraft = {
  id: string;
  graphId: string;
  name: string;
  context: string;
  nfr: ProjectNfr | null;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  analysis?: AnalysisResult | null;
  savedAt: string;
};

export type SyncStatus = "synced" | "saving" | "error" | "offline";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export function saveDraftToLocalStorage(draft: LocalDraft): boolean {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadDraftFromLocalStorage(graphId?: string | null): LocalDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalDraft;
    if (graphId && draft.graphId !== graphId) return null;
    return draft;
  } catch {
    return null;
  }
}

export async function saveDraftToIndexedDB(draft: LocalDraft): Promise<boolean> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadDraftFromIndexedDB(graphId: string): Promise<LocalDraft | null> {
  try {
    const db = await openDB();
    const draft = await new Promise<LocalDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(graphId);
      req.onsuccess = () => resolve((req.result as LocalDraft | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return draft;
  } catch {
    return null;
  }
}

export async function persistLocalDraft(draft: LocalDraft): Promise<boolean> {
  const lsOk = saveDraftToLocalStorage(draft);
  const idbOk = await saveDraftToIndexedDB(draft);
  return lsOk || idbOk;
}
