"use client";

import { Search } from "lucide-react";
import { ALL_NODE_KINDS, ALL_ZONE_KINDS, type CloudProvider, type NodeKind, type ZoneKind } from "@/lib/types";
import { KIND_META } from "@/lib/catalog";
import { ZONE_META } from "@/lib/zones";
import { useGraphStore } from "@/lib/graph-store";
import { EMPTY_CANVAS_FILTER } from "@/lib/canvas-filter";

const PROVIDERS: (CloudProvider | "all")[] = ["all", "aws", "azure", "gcp", "generic"];

export default function SearchFilter() {
  const canvasFilter = useGraphStore((s) => s.canvasFilter);
  const setCanvasFilter = useGraphStore((s) => s.setCanvasFilter);
  const nodes = useGraphStore((s) => s.nodes);

  return (
    <div className="space-y-2 border-b border-white/10 px-3 py-3">
      <label className="relative block">
        <Search size={12} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
        <input
          className="w-full rounded-lg border border-white/10 bg-[#0d1219] py-1.5 pl-7 pr-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
          placeholder="Buscar nó, zona, tech…"
          value={canvasFilter.query}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, query: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        <select
          className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200"
          value={canvasFilter.kind}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, kind: e.target.value as NodeKind | "all" })}
        >
          <option value="all">Domínio</option>
          {ALL_NODE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200"
          value={canvasFilter.zoneKind}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, zoneKind: e.target.value as ZoneKind | "all" })}
        >
          <option value="all">Zona</option>
          {ALL_ZONE_KINDS.map((k) => (
            <option key={k} value={k}>
              {ZONE_META[k].short}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200"
          value={canvasFilter.provider}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, provider: e.target.value as CloudProvider | "all" })}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "Provider" : p.toUpperCase()}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200 outline-none"
          placeholder="Squad / team"
          value={canvasFilter.ownerTeam}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, ownerTeam: e.target.value })}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{nodes.length} nós no canvas</span>
        <button
          type="button"
          className="text-cyan-400 hover:text-cyan-300"
          onClick={() => setCanvasFilter(EMPTY_CANVAS_FILTER)}
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
