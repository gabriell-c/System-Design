/** Local draft persistence for auto-save fallback (localStorage + IndexedDB). */

import type { Edge, Node } from "@xyflow/react";
import type { AnalysisResult, CanvasNodeData, ProjectNfr } from "./types";

export const LOCAL_DRAFT_KEY = "archia-draft";
export const LOCAL_DRAFT_BY_PROJECT_PREFIX = "archia-draft-project:";
export const DB_NAME = "archia-local";
export const STORE_NAME = "drafts";

export type LocalDraft = {
  id: string;
  graphId: string;
  projectId?: string | null;
  name: string;
  context: string;
  nfr: ProjectNfr | null;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  analysis?: AnalysisResult | null;
  excalidraw_elements?: unknown[];
  savedAt: string;
};

export type SyncStatus = "synced" | "saving" | "error" | "offline";

function projectKey(projectId: string): string {
  return `${LOCAL_DRAFT_BY_PROJECT_PREFIX}${projectId}`;
}

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
    if (draft.projectId) {
      localStorage.setItem(projectKey(draft.projectId), JSON.stringify(draft));
    }
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

/** Recupera rascunho associado a um projeto (preferencial) ou ao graphId. */
export function getDraftForProject(projectId: string, graphId?: string | null): LocalDraft | null {
  try {
    const byProject = localStorage.getItem(projectKey(projectId));
    if (byProject) {
      const draft = JSON.parse(byProject) as LocalDraft;
      if (draft.projectId === projectId || !draft.projectId) {
        return draft;
      }
    }
  } catch {
    /* ignore */
  }
  if (graphId) {
    return loadDraftFromLocalStorage(graphId);
  }
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalDraft;
    if (draft.projectId === projectId) return draft;
    return null;
  } catch {
    return null;
  }
}

export function clearDraftForProject(projectId: string): void {
  try {
    localStorage.removeItem(projectKey(projectId));
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw) as LocalDraft;
      if (draft.projectId === projectId) {
        localStorage.removeItem(LOCAL_DRAFT_KEY);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function saveDraftToIndexedDB(draft: LocalDraft): Promise<boolean> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(draft);
      if (draft.projectId) {
        store.put({ ...draft, id: `project:${draft.projectId}` });
      }
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

export async function getDraftForProjectAsync(
  projectId: string,
  graphId?: string | null,
): Promise<LocalDraft | null> {
  const local = getDraftForProject(projectId, graphId);
  if (local) return local;
  try {
    const db = await openDB();
    const byProject = await new Promise<LocalDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(`project:${projectId}`);
      req.onsuccess = () => resolve((req.result as LocalDraft | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (byProject) {
      db.close();
      return byProject;
    }
    if (graphId) {
      const byGraph = await new Promise<LocalDraft | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(graphId);
        req.onsuccess = () => resolve((req.result as LocalDraft | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return byGraph;
    }
    db.close();
  } catch {
    /* ignore */
  }
  return null;
}

export async function persistLocalDraft(draft: LocalDraft): Promise<boolean> {
  const lsOk = saveDraftToLocalStorage(draft);
  const idbOk = await saveDraftToIndexedDB(draft);
  return lsOk || idbOk;
}

/** True se o rascunho local parece mais novo / mais rico que o servidor. */
export function draftLooksNewerThanServer(
  draft: LocalDraft,
  serverUpdatedAt: string | null | undefined,
  serverNodeCount: number,
  serverExcalidrawCount: number,
): boolean {
  const draftNodes = Array.isArray(draft.nodes) ? draft.nodes.length : 0;
  const draftEx = Array.isArray(draft.excalidraw_elements) ? draft.excalidraw_elements.length : 0;
  const draftHasContent = draftNodes > 0 || draftEx > 0;
  if (!draftHasContent) return false;

  const serverEmpty = serverNodeCount <= 0 && serverExcalidrawCount <= 0;
  if (serverEmpty && draftHasContent) return true;

  if (!serverUpdatedAt) return draftHasContent;
  try {
    const draftTs = Date.parse(draft.savedAt);
    const serverTs = Date.parse(serverUpdatedAt);
    if (Number.isFinite(draftTs) && Number.isFinite(serverTs) && draftTs > serverTs + 1000) {
      return draftNodes >= serverNodeCount || draftEx >= serverExcalidrawCount;
    }
  } catch {
    /* ignore */
  }
  return false;
}
