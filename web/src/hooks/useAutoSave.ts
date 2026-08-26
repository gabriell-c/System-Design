import { useEffect, useRef } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { useAuthStore } from "@/lib/auth-store";
import { persistLocalDraft, type SyncStatus } from "@/lib/local-draft";

const LOCAL_DRAFT_INTERVAL_MS = 5_000;
const COMPRESSION_THRESHOLD = 50; // Compress payloads with > 50 nodes

type SyncListener = (status: SyncStatus) => void;
const syncListeners = new Set<SyncListener>();
let currentSyncStatus: SyncStatus = "synced";

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncListeners.delete(listener);
  };
}

function setSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  for (const listener of syncListeners) {
    listener(status);
  }
}

/** Compress JSON payload using browser's native CompressionStream API */
async function compressPayload<T>(data: T): Promise<string> {
  const json = JSON.stringify(data);
  if (json.length < 1024) return json; // Don't compress small payloads

  try {
    const blob = new Blob([json]);
    const compressedBlob = await new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    const buffer = await compressedBlob.arrayBuffer();
    // Convert to base64 for transmission
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  } catch {
    // Fallback to uncompressed if compression fails
    return json;
  }
}

/** Decompress base64-encoded gzip payload */
async function decompressPayload(base64: string): Promise<string> {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes]);
    const decompressedBlob = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
    return await decompressedBlob.text();
  } catch {
    // Fallback to raw JSON if decompression fails
    return base64;
  }
}

export function useAutoSave() {
  const user = useAuthStore((s) => s.user);
  const graphId = useGraphStore((s) => s.graphId);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist draft locally every 5s (independent of backend).
  useEffect(() => {
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    localTimerRef.current = setInterval(() => {
      const state = useGraphStore.getState();
      if (!state.graphId || state.nodes.length === 0) return;
      void persistLocalDraft({
        id: state.graphId,
        graphId: state.graphId,
        name: state.name,
        context: state.context,
        nfr: state.nfr,
        nodes: state.nodes,
        edges: state.edges,
        analysis: state.analysis,
        savedAt: new Date().toISOString(),
      });
    }, LOCAL_DRAFT_INTERVAL_MS);
    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!user || !user.auto_save_enabled || !graphId) return;
    const intervalMin = user.auto_save_interval_minutes;
    if (!intervalMin || intervalMin <= 0) return;
    const ms = intervalMin * 60 * 1000;
    timerRef.current = setInterval(() => {
      const state = useGraphStore.getState();
      if (!state.graphId) return;

      setSyncStatus("saving");
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";
      const payload = {
        nodes: state.nodes,
        edges: state.edges,
      };
      // Compress payload if large enough
      const payloadJson = JSON.stringify(payload);
      const body = payloadJson.length > 1024
        ? await compressPayload(payload)
        : payloadJson;

      void fetch(`${base}/api/v1/graphs/${state.graphId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(body !== payloadJson ? { "Content-Encoding": "gzip" } : {}),
        },
        body,
      })
        .then(async (res) => {
          if (res.ok) {
            setSyncStatus("synced");
            state.markSaved(state.graphId!);
            return;
          }
          setSyncStatus("error");
          const detail = await res.text().catch(() => "");
          state.pushUiNotice({
            type: "error",
            text: detail
              ? `Falha ao salvar automaticamente (${res.status}). Rascunho local mantido.`
              : "Falha ao salvar automaticamente. Verifique a conexão — rascunho local mantido.",
          });
          void persistLocalDraft({
            id: state.graphId!,
            graphId: state.graphId!,
            name: state.name,
            context: state.context,
            nfr: state.nfr,
            nodes: state.nodes,
            edges: state.edges,
            analysis: state.analysis,
            savedAt: new Date().toISOString(),
          });
        })
        .catch(() => {
          setSyncStatus("offline");
          state.pushUiNotice({
            type: "error",
            text: "Offline — não foi possível salvar no servidor. Rascunho salvo localmente.",
          });
          void persistLocalDraft({
            id: state.graphId!,
            graphId: state.graphId!,
            name: state.name,
            context: state.context,
            nfr: state.nfr,
            nodes: state.nodes,
            edges: state.edges,
            analysis: state.analysis,
            savedAt: new Date().toISOString(),
          });
        });
    }, ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, graphId]);
}
