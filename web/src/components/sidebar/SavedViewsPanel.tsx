"use client";

import { Bookmark, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { deleteSavedView, listSavedViews } from "@/lib/saved-views";
import type { SavedView } from "@/lib/types";
import PanelEmpty from "@/components/ui/PanelEmpty";

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
    void Promise.resolve().then(() => {
      refresh();
    });
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
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
        Nenhuma view salva · use &quot;Salvar view&quot; nos filtros
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--border)] px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium text-slate-300"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Bookmark size={12} className="text-[var(--accent)]" />
          Views salvas
        </span>
        <span className="rounded bg-white/5 px-2 py-0.5 text-sm text-[var(--muted-fg)]">{views.length}</span>
      </button>
      {expanded && (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
          {views.map((view) => (
            <li
              key={view.id}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-black/20 px-2 py-1"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm text-slate-200 hover:text-indigo-300"
                title={view.tags.length ? view.tags.join(", ") : view.name}
                onClick={() => loadView(view)}
              >
                {view.name}
                {view.tags.length > 0 && (
                  <span className="ml-1 text-sm text-[var(--muted)]">· {view.tags.join(", ")}</span>
                )}
              </button>
              <button
                type="button"
                className="shrink-0 text-[var(--muted)] hover:text-rose-400"
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
            <li>
              <PanelEmpty
                icon={Bookmark}
                title="Nenhuma view salva"
                description='Use "Salvar view" nos filtros para criar uma.'
              />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
