"use client";

import { LAYER_VIEWS } from "@/lib/canvas-filter";
import { useGraphStore } from "@/lib/graph-store";

export default function ViewTabs() {
  const canvasFilter = useGraphStore((s) => s.canvasFilter);
  const setCanvasFilter = useGraphStore((s) => s.setCanvasFilter);

  return (
    <div className="flex flex-wrap gap-1 border-b border-white/10 px-3 py-2">
      {LAYER_VIEWS.map((view) => {
        const on = canvasFilter.layerView === view.id;
        return (
          <button
            key={view.id}
            type="button"
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              on
                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 text-slate-400 hover:border-white/20"
            }`}
            onClick={() => setCanvasFilter({ ...canvasFilter, layerView: view.id })}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
