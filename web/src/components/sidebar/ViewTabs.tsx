"use client";

import { LAYER_VIEWS } from "@/lib/canvas-filter";
import { ARCHITECTURE_VIEWS, type ArchitectureView } from "@/lib/architecture-view";
import { useGraphStore } from "@/lib/graph-store";

export default function ViewTabs() {
  const canvasFilter = useGraphStore((s) => s.canvasFilter);
  const setCanvasFilter = useGraphStore((s) => s.setCanvasFilter);
  const architectureView = useGraphStore((s) => s.architectureView);
  const setArchitectureView = useGraphStore((s) => s.setArchitectureView);
  const drillDownToView = useGraphStore((s) => s.drillDownToView);

  return (
    <div className="border-b border-white/10">
      {/* P3.1.1 — 4+1 Architecture Views */}
      <div className="flex flex-wrap gap-1 px-3 py-1.5">
        {ARCHITECTURE_VIEWS.map((view) => {
          const active = architectureView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                active
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
              onClick={() => drillDownToView(view.id)}
              title={view.label}
            >
              {view.short}
            </button>
          );
        })}
      </div>
      {/* Layer Views */}
      <div className="flex flex-wrap gap-1 px-3 py-1.5">
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
    </div>
  );
}
