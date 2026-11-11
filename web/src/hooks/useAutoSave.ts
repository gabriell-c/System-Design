/**
 * Auto-save confiável para o Archia.
 * Respeita o intervalo configurado no perfil do usuário.
 *
 * Comportamento:
 * - Ao editar: marca como dirty, mas NÃO salva imediatamente.
 * - Periodicamente (a cada N minutos do perfil): salva se dirty.
 * - Ao perder foco da janela: salva se dirty.
 * - Botão manual: salva na hora.
 *
 * Conflito 409 (versão stale): em vez de travar em "error", re-basou da
 * versão do servidor e mescla local (LWW por elemento — local-tocado vence,
 * adições do servidor preservadas) sem descartar o rascunho. Tenta salvar
 * de novo uma vez; em nova falha, mantém dirty + etag rebasado para o
 * próximo ciclo refazer sem loop infinito.
 */
import { useEffect, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useGraphStore } from "@/lib/graph-store";
import { useAuthStore } from "@/lib/auth-store";
import { api, ApiConflictError } from "@/lib/api";
import type { CanvasNodeData } from "@/lib/types";
import { mergeGraphSnapshots } from "@/lib/collab";

const CHECK_INTERVAL_MS = 10000; // Verifica a cada 10s se precisa salvar
const MAX_SAVE_INTERVAL_MS = 15 * 60 * 1000; // Teto: máximo 15 min

function buildPayload(state: ReturnType<typeof useGraphStore.getState>) {
  return {
    name: state.name,
    context: state.context,
    nfr: state.nfr,
    nodes: state.nodes,
    edges: state.edges,
    project_id: state.projectId,
    owner_team: state.ownerTeam ?? null,
    diagram_kind: state.diagramKind,
    parent_graph_id: state.parentGraphId,
    c4_parent_node_id: state.c4ParentNodeId,
    excalidraw_elements: state.excalidrawElements ?? [],
  };
}

/**
 * Recuperação não-destrutiva de 409: puxa a versão atual do servidor e aplica
 * um merge LWW element-wise (local-tocado vence; adições/edições do servidor
 * em outros elementos entram) sem tocar no undo. Retorna true se rebasou.
 */
async function recoverFromConflict(graphId: string): Promise<boolean> {
  const state = useGraphStore.getState();
  try {
    const server = await api.getGraph(graphId); // sem If-Match → versão vigente
    const merged = mergeGraphSnapshots(
      {
        nodes: state.nodes as unknown[],
        edges: state.edges as unknown[],
        excalidrawElements: state.excalidrawElements as unknown[],
      },
      {
        nodes: (server.nodes as unknown[]) ?? [],
        edges: (server.edges as unknown[]) ?? [],
        excalidrawElements: server.excalidraw_elements ?? undefined,
      },
      {
        // local-tocado vence: todo id local é "tocado"; server-only entra por união
        nodes: new Set(state.nodes.map((n) => n.id)),
        edges: new Set(state.edges.map((e) => e.id)),
      },
    );
    state.applyRemote({
      nodes: merged.nodes as unknown as Node<CanvasNodeData>[],
      edges: merged.edges as unknown as Edge[],
      excalidrawElements: merged.excalidrawElements as unknown as ExcalidrawElement[],
      name: server.name,
      context: server.context ?? "",
      nfr: server.nfr ?? undefined,
      analysis: server.analysis ?? null,
    });
    state.setLastEtag(server.etag ?? null);
    return true;
  } catch {
    return false;
  }
}

async function saveGraph(): Promise<boolean> {
  const state = useGraphStore.getState();

  if (!state.graphId || !state.projectId) {
    return false;
  }
  if (!state.dirty) {
    return false;
  }

  state.setSaveStatus("saving");

  try {
    const saved = await api.updateGraph(state.graphId, buildPayload(state), {
      ifMatch: state.lastEtag,
    });

    state.markSaved(state.graphId, saved.etag ?? null);
    state.pushUiNotice({ type: "success", text: "Salvo automaticamente" });
    return true;
  } catch (error) {
    if (error instanceof ApiConflictError) {
      const recovered = await recoverFromConflict(state.graphId);
      if (recovered) {
        // Re-salva uma vez com o etag freso agora no store.
        const s2 = useGraphStore.getState();
        try {
          const saved2 = await api.updateGraph(state.graphId, buildPayload(s2), {
            ifMatch: s2.lastEtag,
          });
          s2.markSaved(state.graphId, saved2.etag ?? null);
          s2.pushUiNotice({ type: "success", text: "Salvo automaticamente (conflito resolvido)" });
          return true;
        } catch {
          // Ainda em conflito neste instante: etag já rebasado + dirty; o
          // próximo ciclo refaz sem travar em "error".
          s2.pushUiNotice({
            type: "info",
            text: "Conflito de versão: mesclado com o servidor. Será re-salvo em instantes.",
          });
          s2.setSaveStatus("dirty");
          return false;
        }
      }
      state.pushUiNotice({ type: "error", text: "Conflito de versão. Salve manualmente para resolver." });
      state.setSaveStatus("error");
      return false;
    }

    console.error("[AutoSave] erro:", error);
    state.pushUiNotice({ type: "error", text: "Erro ao salvar. Rascunho local mantido." });
    state.setSaveStatus("error");
    return false;
  }
}

export function useAutoSave() {
  const user = useAuthStore((s) => s.user);
  const autoSaveEnabled = user?.auto_save_enabled ?? true;
  const autoSaveIntervalMinutes = user?.auto_save_interval_minutes ?? 15;

  // Ref para o timestamp do último save — survives HMR, stable across renders
  // Inicializado como null (Date.now() no render seria impuro; a 1ª checagem
  // periódica define a referência do "agora").
  const lastSaveTimeRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const autoSaveEnabledRef = useRef(autoSaveEnabled);
  const autoSaveIntervalMinutesRef = useRef(autoSaveIntervalMinutes);

  // Keep refs in sync with props
  useEffect(() => {
    autoSaveEnabledRef.current = autoSaveEnabled;
  }, [autoSaveEnabled]);

  useEffect(() => {
    autoSaveIntervalMinutesRef.current = autoSaveIntervalMinutes;
  }, [autoSaveIntervalMinutes]);

  // Periodic check
  useEffect(() => {
    const intervalMs = Math.min(autoSaveIntervalMinutes * 60 * 1000, MAX_SAVE_INTERVAL_MS);

    const periodicInterval = setInterval(async () => {
      if (!autoSaveEnabledRef.current) return;

      const state = useGraphStore.getState();
      if (!state.graphId || !state.projectId || !state.dirty || isSavingRef.current) return;

      if (lastSaveTimeRef.current === null) {
        lastSaveTimeRef.current = Date.now();
      }
      const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
      if (timeSinceLastSave >= intervalMs) {
        isSavingRef.current = true;
        try {
          await saveGraph();
        } finally {
          isSavingRef.current = false;
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(periodicInterval);
  }, [autoSaveEnabled, autoSaveIntervalMinutes]);

  // Save on window focus
  useEffect(() => {
    const onFocus = async () => {
      if (!autoSaveEnabledRef.current) return;
      const state = useGraphStore.getState();
      if (!state.graphId || !state.projectId || !state.dirty || isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        await saveGraph();
      } finally {
        isSavingRef.current = false;
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [autoSaveEnabled]);

  // Reset lastSaveTime when switching projects
  const prevProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    const state = useGraphStore.getState();
    if (prevProjectIdRef.current !== state.projectId) {
      prevProjectIdRef.current = state.projectId;
      lastSaveTimeRef.current = Date.now();
    }
  });
}
