/**
 * Auto-save confiável para o Archia.
 * Respeita o intervalo configurado no perfil do usuário.
 *
 * Comportamento:
 * - Ao editar: marca como dirty, mas NÃO salva imediatamente.
 * - Periodicamente (a cada N minutos do perfil): salva se dirty.
 * - Ao perder foco da janela: salva se dirty.
 * - Botão manual: salva na hora.
 */
import { useEffect, useRef } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";

const CHECK_INTERVAL_MS = 10000; // Verifica a cada 10s se precisa salvar
const MAX_SAVE_INTERVAL_MS = 15 * 60 * 1000; // Teto: máximo 15 min

async function saveGraph(): Promise<boolean> {
  const state = useGraphStore.getState();

  if (!state.graphId || !state.projectId) {
    console.log("[AutoSave] skip — sem graphId ou projectId");
    return false;
  }
  if (!state.dirty) {
    return false;
  }

  console.log("[AutoSave] salvando…", {
    graphId: state.graphId.slice(0, 8),
    nodes: state.nodes.length,
    edges: state.edges.length,
  });

  state.setSaveStatus("saving");

  try {
    const payload = {
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

    const saved = await api.updateGraph(state.graphId, payload, {
      ifMatch: state.lastEtag,
    });

    state.markSaved(state.graphId, saved.etag ?? null);
    console.log("[AutoSave] ✓ salvo");
    state.pushUiNotice({ type: "success", text: "Salvo automaticamente" });
    return true;
  } catch (error) {
    console.error("[AutoSave] erro:", error);
    const err = error as { status?: number };
    if (err.status === 409) {
      state.pushUiNotice({ type: "error", text: "Conflito de versão. Salve manualmente." });
    } else {
      state.pushUiNotice({ type: "error", text: "Erro ao salvar. Rascunho local mantido." });
    }
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
        console.log("[AutoSave] backup periódico…", { intervalMs, timeSinceLastSave });
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
