"use client";

/**
 * Diagrama Livre = Excalidraw oficial, sem chrome Archia.
 * Isolation: remounts when graphId changes so the scene never leaks across projects.
 */
import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useGraphStore } from "@/lib/graph-store";
import { api } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, CloudCheck, CloudOff } from "lucide-react";

// Subset da API imperativa que usamos do Excalidraw (o tipo completo não é
// re-exportado pela raiz do pacote). O parâmetro omite os campos opcionais
// (appState/collaborators/captureUpdate); método bivariante permite a atribuição.
type ExcalidrawLiveApi = {
  updateScene: (sceneData: { elements?: readonly ExcalidrawElement[] }) => void;
};

// Janela de "edição local recente": o feed remoto não pisar no traço que o
// usuário está desenhando agora — só aplica a cena remota quando parou.
const REMOTE_FEED_IDLE_MS = 1200;

function elementsFingerprint(elements: readonly ExcalidrawElement[]): string {
  let h = 2166136261;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  mix(String(elements.length));
  for (const el of elements) {
    mix(el.id);
    mix(el.type);
    mix(String(el.version ?? 0));
    mix(String(el.versionNonce ?? 0));
    mix(String(el.isDeleted ? 1 : 0));
    mix(String(Math.round(el.x)));
    mix(String(Math.round(el.y)));
    mix(String(Math.round(el.width)));
    mix(String(Math.round(el.height)));
    mix(String(el.updated ?? 0));
  }
  return (h >>> 0).toString(36);
}

function hideSocialLinks(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[class*="dropdown-menu-group"]').forEach((group) => {
    const title = group.querySelector<HTMLElement>('[class*="dropdown-menu-group-title"]');
    if (title && title.textContent?.includes("Excalidraw")) {
      group.style.display = "none";
    }
  });
  root
    .querySelectorAll<HTMLElement>(
      '[aria-label="GitHub"], [title="GitHub"], [aria-label="Discord"], [title="Discord"]',
    )
    .forEach((el) => {
      if (el.parentElement) el.parentElement.style.display = "none";
    });
  root.querySelectorAll<HTMLElement>('[class*="dropdown-menu-item"]').forEach((item) => {
    const text = item.textContent?.trim() || "";
    if (text === "GitHub" || text === "Discord" || text === "Follow us") {
      item.style.display = "none";
    }
  });
}

export default function ExcalidrawWrapper() {
  const graphId = useGraphStore((s) => s.graphId);
  const projectId = useGraphStore((s) => s.projectId);
  const elements = useGraphStore((s) => s.excalidrawElements ?? []);
  const dirty = useGraphStore((s) => s.dirty);
  const saveStatus = useGraphStore((s) => s.saveStatus);
  const setSaveStatus = useGraphStore((s) => s.setSaveStatus);
  const markSaved = useGraphStore((s) => s.markSaved);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const name = useGraphStore((s) => s.name);
  const context = useGraphStore((s) => s.context);
  const nfr = useGraphStore((s) => s.nfr);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const diagramKind = useGraphStore((s) => s.diagramKind);
  const parentGraphId = useGraphStore((s) => s.parentGraphId);
  const c4ParentNodeId = useGraphStore((s) => s.c4ParentNodeId);
  const ownerTeam = useGraphStore((s) => s.ownerTeam);
  const lastEtag = useGraphStore((s) => s.lastEtag);
  const setElements = useGraphStore((s) => s.setExcalidrawElements);
  const lastFpRef = useRef(elementsFingerprint(elements));
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExcalidrawLiveApi | null>(null);
  const lastLocalEditRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep fingerprint aligned when store resets / another graph loads.
  useEffect(() => {
    lastFpRef.current = elementsFingerprint(elements);
  }, [graphId, elements]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const ro = new ResizeObserver(() => {
      if (check()) ro.disconnect();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSave = useCallback(async () => {
    if (!graphId || !projectId) {
      pushUiNotice({ type: "error", text: "Nenhum projeto ou diagrama selecionado." });
      return;
    }
    if (saving) return;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const payload = {
        name,
        context,
        nfr,
        nodes,
        edges,
        project_id: projectId,
        owner_team: ownerTeam || null,
        diagram_kind: diagramKind,
        parent_graph_id: parentGraphId,
        c4_parent_node_id: c4ParentNodeId,
        excalidraw_elements: elements,
      };
      const saved = await api.updateGraph(graphId, payload, { ifMatch: lastEtag });
      markSaved(saved.id, saved.etag ?? null);
      pushUiNotice({ type: "success", text: "Diagrama salvo com sucesso!" });
    } catch (err) {
      console.error("[ExcalidrawWrapper] Save error:", err);
      setSaveStatus("error");
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha ao salvar. Verifique a conexão.",
      });
    } finally {
      setSaving(false);
    }
  }, [
    graphId,
    projectId,
    saving,
    setSaveStatus,
    markSaved,
    pushUiNotice,
    name,
    context,
    nfr,
    nodes,
    edges,
    diagramKind,
    parentGraphId,
    c4ParentNodeId,
    ownerTeam,
    lastEtag,
    elements,
  ]);

  const onChange = useCallback(
    (next: readonly ExcalidrawElement[]) => {
      const fp = elementsFingerprint(next);
      if (fp === lastFpRef.current) return;
      lastFpRef.current = fp;
      lastLocalEditRef.current = Date.now();
      setElements([...next]);
    },
    [setElements],
  );

  // Esconde os links sociais do Excalidraw. Observa o CONTAINER (não o
  // document.body inteiro) — só a subtree desta instância re-renderiza os
  // menus, então evita callbacks globais a cada mutação de DOM do app.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const run = () => hideSocialLinks(el);
    const observer = new MutationObserver(() => {
      setTimeout(run, 50);
    });
    observer.observe(el, { childList: true, subtree: true });
    run();
    return () => observer.disconnect();
  }, []);

  // Feed remoto ao vivo: quando a cena no store muda por causa de um peer
  // (fingerprint ≠ estado local do canvas), aplica via updateScene. Só se o
  // usuário está ocioso (não em edição) pra não pisar no traço em curso.
  useEffect(() => {
    if (!ready) return; // feed remoto só aplica quando o Excalidraw montou
    const api = apiRef.current;
    if (!api) return;
    const fp = elementsFingerprint(elements);
    if (fp === lastFpRef.current) return; // já é o estado local, não remoto
    if (Date.now() - lastLocalEditRef.current < REMOTE_FEED_IDLE_MS) return;
    lastFpRef.current = fp;
    api.updateScene({ elements: [...elements] });
  }, [elements, ready]);

  // Fresh instance per graphId — initialData from THIS render's store slice only.
  const mountKey = graphId ?? "empty";

  const statusIcon =
    saveStatus === "error" ? (
      <CloudOff size={14} />
    ) : saveStatus === "saved" ? (
      <CloudCheck size={14} />
    ) : saveStatus === "saving" ? (
      <Cloud size={14} className="animate-pulse" />
    ) : dirty ? (
      <Cloud size={14} />
    ) : (
      <Cloud size={14} />
    );

  return (
    <div
      ref={containerRef}
      data-testid="excalidraw-container"
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      {ready ? (
        <>
          <Excalidraw
            key={mountKey}
            initialData={{ elements: elements as ExcalidrawElement[] }}
            onChange={onChange}
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            langCode="pt-BR"
            theme="light"
          />
          {/* Save button — fixed top-right */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!graphId || !projectId || saving}
            title={saving ? "Salvando…" : dirty ? "Salvar diagrama (Ctrl+S)" : "Salvo"}
            style={{
              position: "absolute",
              top: 12,
              right: 72,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              cursor: dirty && graphId && projectId ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              background:
                saving
                  ? "rgba(59,130,246,0.9)"
                  : dirty && graphId && projectId
                    ? "rgba(34,197,94,0.9)"
                    : "rgba(100,116,139,0.6)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              transition: "background 0.2s",
              pointerEvents: saving ? "none" : "auto",
            }}
          >
            {statusIcon}
            <span>
              {saving
                ? "Salvando…"
                : saveStatus === "saved"
                  ? "Salvo"
                  : dirty
                    ? "Salvar"
                    : "Sem projeto"}
            </span>
          </button>
        </>
      ) : null}
    </div>
  );
}
