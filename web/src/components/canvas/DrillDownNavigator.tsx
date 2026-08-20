"use client";

import { ChevronRight, Layers } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";
import { diagramKindLabel, type DiagramKind } from "@/lib/diagram-library";
import { isArchData, type C4Level } from "@/lib/types";

type Props = {
  diagramKind?: DiagramKind | string | null;
  parentGraphId?: string | null;
  onDrillToChild?: (nodeId: string, c4Level: C4Level) => void;
};

/** P0.1.4 — Navegação C4 drill-down com breadcrumb. */
export default function DrillDownNavigator({ diagramKind, parentGraphId, onDrillToChild }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setC4Level = useGraphStore((s) => s.setC4Level);

  const selected = nodes.find((n) => n.id === selectedNodeId);
  const canDrill = Boolean(selected && isArchData(selected.data));

  const crumbs = [
    parentGraphId ? "Pacote" : "Raiz",
    diagramKind ? diagramKindLabel(diagramKind) : "Diagrama",
    selected && "data" in selected.data ? selected.data.label : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1219]/95 px-3 py-2 text-xs text-slate-300">
      <Layers size={14} className="text-cyan-400 shrink-0" />
      <nav aria-label="C4 drill-down" className="flex flex-wrap items-center gap-1 min-w-0">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-slate-600" />}
            <span className={i === crumbs.length - 1 ? "text-slate-100 font-medium truncate" : "text-slate-500"}>
              {c}
            </span>
          </span>
        ))}
      </nav>
      {canDrill && selected && isArchData(selected.data) && (
        <button
          type="button"
          className="ml-auto shrink-0 rounded-md bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/25"
          onClick={() => {
            const data = selected.data;
            if (!isArchData(data)) return;
            const nextLevel: C4Level =
              data.c4Level === "system" || !data.c4Level
                ? "container"
                : data.c4Level === "container"
                  ? "component"
                  : "code";
            setC4Level(selected.id, nextLevel);
            onDrillToChild?.(selected.id, nextLevel);
          }}
        >
          Drill-down →
        </button>
      )}
    </div>
  );
}
