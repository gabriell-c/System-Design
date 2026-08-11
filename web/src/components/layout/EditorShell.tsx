"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import DesignCanvas from "@/components/canvas/DesignCanvas";
import DomainNotice from "@/components/layout/DomainNotice";
import Inspector from "@/components/panels/Inspector";
import ComponentPalette from "@/components/sidebar/ComponentPalette";
import ResizablePanel from "@/components/ui/ResizablePanel";
import { api } from "@/lib/api";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useGraphStore } from "@/lib/graph-store";
import TopBar from "./TopBar";

const FOCUS_KEY = "archia-focus-mode";

function structureKey(
  nodes: {
    id: string;
    parentId?: string;
    data: { kind: string; catalogId?: string; label: string; config?: unknown; domain?: string };
  }[],
  edges: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[],
): string {
  return JSON.stringify({
    nodes: nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId ?? null,
      kind: n.data.kind,
      domain: n.data.domain ?? null,
      catalogId: n.data.catalogId ?? null,
      label: n.data.label,
      config: n.data.config ?? null,
    })),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export default function EditorShell() {
  useAutoSave();

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
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(FOCUS_KEY) === "1") setFocusMode(true);
    } catch {
      /* ignore */
    }
  }, []);

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
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runAnalyzeRef.current({ silent: true });
    }, 2000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fingerprint]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!focusMode && (
        <TopBar onAnalyze={() => void runAnalyze()} onToggleFocus={toggleFocus} focusMode={focusMode} />
      )}
      <div className="flex min-h-0 flex-1">
        {!focusMode && (
          <ResizablePanel storageKey="archia-sidebar-left" defaultWidth={300} side="left">
            <ComponentPalette />
          </ResizablePanel>
        )}
        <main className="relative min-w-0 flex-1 bg-[#070b10]">
          <DomainNotice />
          <DesignCanvas />
          {focusMode && (
            <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-2">
              <span className="pointer-events-none hidden rounded-lg border border-white/10 bg-[#0d1219]/90 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur sm:inline">
                Esc sai · F alterna
              </span>
              <button
                type="button"
                className="pointer-events-auto btn-ghost inline-flex items-center gap-1.5 bg-[#0d1219]/95 shadow-lg backdrop-blur"
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
              className="absolute right-3 top-3 z-20 btn-ghost inline-flex items-center gap-1.5 bg-[#0d1219]/80 backdrop-blur lg:hidden"
              onClick={toggleFocus}
              title="Tela cheia (F)"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </main>
        {!focusMode && (
          <ResizablePanel storageKey="archia-sidebar-right" defaultWidth={380} side="right">
            <Inspector />
          </ResizablePanel>
        )}
      </div>
    </div>
  );
}
