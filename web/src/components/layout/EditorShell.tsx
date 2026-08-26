"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import DesignCanvas from "@/components/canvas/DesignCanvas";
import DomainNotice from "@/components/layout/DomainNotice";
import Inspector from "@/components/panels/Inspector";
import ComponentPalette from "@/components/sidebar/ComponentPalette";
import FreePalette from "@/components/sidebar/FreePalette";
import DiagramSidebar from "@/components/sidebar/DiagramSidebar";
import PresentationMode from "@/components/layout/PresentationMode";
import ResizablePanel from "@/components/ui/ResizablePanel";
import { api } from "@/lib/api";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useGraphStore } from "@/lib/graph-store";
import { useProjectStore } from "@/lib/project-store";
import TopBar from "./TopBar";

const FOCUS_KEY = "archia-focus-mode";
const AUTO_ANALYZE_KEY = "archia-auto-analyze";

/** Lightweight stable fingerprint — avoids JSON.stringify of full graph each change. */
function structureKey(
  nodes: {
    id: string;
    parentId?: string;
    data: { kind: string; catalogId?: string; label: string; config?: unknown; domain?: string };
  }[],
  edges: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[],
): string {
  let h = 2166136261;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  mix(String(nodes.length));
  for (const n of nodes) {
    mix(n.id);
    mix(n.parentId ?? "");
    mix(n.data.kind);
    mix(n.data.domain ?? "");
    mix(n.data.catalogId ?? "");
    mix(n.data.label);
    mix(typeof n.data.config === "string" ? n.data.config : JSON.stringify(n.data.config ?? null));
  }
  mix(String(edges.length));
  for (const e of edges) {
    mix(e.source);
    mix(e.target);
    mix(e.sourceHandle ?? "");
    mix(e.targetHandle ?? "");
  }
  return (h >>> 0).toString(36);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export default function EditorShell() {
  useAutoSave();
  const { loadProjects, projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const isFreeProject = activeProject?.project_kind === "free";

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const name = useGraphStore((s) => s.name);
  const context = useGraphStore((s) => s.context);
  const nfr = useGraphStore((s) => s.nfr);
  const graphId = useGraphStore((s) => s.graphId);
  const setAnalysis = useGraphStore((s) => s.setAnalysis);
  const setAnalyzing = useGraphStore((s) => s.setAnalyzing);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);
  const [focusMode, setFocusMode] = useState(() => {
    try {
      return localStorage.getItem(FOCUS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const setFocus = useCallback(
    (value: boolean) => {
      setFocusMode(value);
      try {
        localStorage.setItem(FOCUS_KEY, value ? "1" : "0");
      } catch {
        /* ignore */
      }
      pushUiNotice({
        type: "info",
        text: value
          ? "Tela cheia do canvas · Esc ou botão para sair"
          : "Painéis restaurados",
      });
    },
    [pushUiNotice],
  );

  const toggleFocus = useCallback(() => {
    setFocus(!focusMode);
  }, [focusMode, setFocus]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape" && focusMode) {
        event.preventDefault();
        setFocus(false);
        return;
      }
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleFocus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, setFocus, toggleFocus]);

  const fingerprint = useMemo(
    () => structureKey(nodes, edges) + "|" + context.trim() + "|" + JSON.stringify(nfr),
    [nodes, edges, context, nfr],
  );

  const runAnalyze = useCallback(async (opts?: { silent?: boolean }) => {
    if (nodes.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await api.analyze({ name, context, nfr, nodes, edges, persist_id: graphId });
      setAnalysis(result);
      setAnalyzing(false);
      if (!opts?.silent) {
        const ia = result.ia_ok ? "com IA" : "heurística local";
        pushUiNotice({
          type: "success",
          text: `Análise pronta (${ia}) · nota ${result.score.toFixed(1)}. Veja a aba Análise.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na análise";
      setAnalyzing(false, msg);
      if (!opts?.silent) pushUiNotice({ type: "error", text: msg });
    }
  }, [context, edges, graphId, name, nfr, nodes, pushUiNotice, setAnalysis, setAnalyzing]);

  const runAnalyzeRef = useRef(runAnalyze);
  useEffect(() => {
    runAnalyzeRef.current = runAnalyze;
  });

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (isFreeProject) return;
    let enabled = false;
    try {
      enabled = localStorage.getItem(AUTO_ANALYZE_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runAnalyzeRef.current({ silent: true });
    }, 2000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fingerprint, isFreeProject]);

  return (
    <div className="flex h-full min-h-0 bg-[var(--background)] text-[var(--foreground)]">
      <DomainNotice />
      <DiagramSidebar collapsed={true} />
      <div className="flex min-h-0 flex-1 flex-col">
        {!focusMode && (
          <TopBar
            onAnalyze={() => void runAnalyze()}
            onToggleFocus={toggleFocus}
            focusMode={focusMode}
            hideAnalysis={isFreeProject}
          />
        )}
        <div className="flex min-h-0 flex-1">
          {!focusMode && (
            <ResizablePanel storageKey="archia-sidebar-left" defaultWidth={300} side="left">
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {isFreeProject ? <FreePalette /> : <ComponentPalette />}
              </div>
            </ResizablePanel>
          )}
          <main className="relative min-w-0 flex-1 bg-[var(--canvas-bg)]">
            <DesignCanvas />
            {focusMode && (
              <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-2">
                <span className="pointer-events-none hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/90 px-2.5 py-1 text-sm text-[var(--muted-fg)] backdrop-blur sm:inline">
                  Esc sai · F alterna
                </span>
                <button
                  type="button"
                  className="pointer-events-auto btn-ghost inline-flex items-center gap-1.5 bg-[var(--surface-1)]/95 elev-2 backdrop-blur"
                  onClick={() => setFocus(false)}
                  title="Sair da tela cheia (Esc)"
                >
                  <Minimize2 size={14} />
                  Sair
                </button>
              </div>
            )}
            {!focusMode && (
              <button
                type="button"
                className="absolute right-3 top-3 z-20 btn-ghost inline-flex items-center gap-1.5 bg-[var(--surface-1)]/80 backdrop-blur lg:hidden"
                onClick={toggleFocus}
                title="Tela cheia (F)"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </main>
          {!focusMode && (
            <ResizablePanel storageKey="archia-sidebar-right" defaultWidth={380} side="right">
              <Inspector hideAnalysis={isFreeProject} />
            </ResizablePanel>
          )}
        </div>
      </div>
      {/* P3.1.2 — Presentation Mode */}
      <PresentationMode graphId={graphId ?? ""} />
    </div>
  );
}
