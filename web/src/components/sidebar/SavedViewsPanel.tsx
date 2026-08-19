"use client";

import { Bookmark, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { deleteSavedView, listSavedViews } from "@/lib/saved-views";
import type { SavedView } from "@/lib/types";

export default function SavedViewsPanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const savedViewsTick = useGraphStore((s) => s.savedViewsTick);
  const loadView = useGraphStore((s) => s.loadView);
  const [views, setViews] = useState<SavedView[]>([]);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(() => {
    setViews(listSavedViews(graphId));
  }, [graphId]);

  useEffect(() => {
    refresh();
  }, [refresh, savedViewsTick]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key?.startsWith("archia-saved-views")) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  if (views.length === 0 && !expanded) {
    return (
      <div className="border-b border-white/10 px-3 py-2 text-[10px] text-slate-500">
        Nenhuma view salva · use &quot;Salvar view&quot; nos filtros
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-[11px] font-medium text-slate-300"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Bookmark size={12} className="text-cyan-400" />
          Views salvas
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{views.length}</span>
      </button>
      {expanded && (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
          {views.map((view) => (
            <li
              key={view.id}
              className="flex items-center gap-1 rounded-md border border-white/5 bg-black/20 px-2 py-1"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-200 hover:text-cyan-300"
                title={view.tags.length ? view.tags.join(", ") : view.name}
                onClick={() => loadView(view)}
              >
                {view.name}
                {view.tags.length > 0 && (
                  <span className="ml-1 text-[9px] text-slate-500">· {view.tags.join(", ")}</span>
                )}
              </button>
              <button
                type="button"
                className="shrink-0 text-slate-500 hover:text-rose-400"
                title="Remover view"
                onClick={() => {
                  deleteSavedView(graphId, view.id);
                  refresh();
                }}
              >
                <Trash2 size={11} />
              </button>
            </li>
          ))}
          {views.length === 0 && (
            <li className="text-[10px] text-slate-500">Nenhuma view salva ainda.</li>
          )}
        </ul>
      )}
    </div>
  );
}
