"use client";

import { BookmarkPlus, Search } from "lucide-react";
import { useState } from "react";
import { ALL_C4_LEVELS, ALL_NODE_KINDS, ALL_ZONE_KINDS, type C4Level, type CloudProvider, type NodeKind, type PiiSensitivity, type ZoneKind } from "@/lib/types";
import { KIND_META } from "@/lib/catalog";
import { ZONE_META } from "@/lib/zones";
import { useGraphStore } from "@/lib/graph-store";
import { EMPTY_CANVAS_FILTER } from "@/lib/canvas-filter";
import { CATALOG } from "@/lib/catalog";

const PROVIDERS: (CloudProvider | "all")[] = ["all", "aws", "azure", "gcp", "generic"];

const PII_OPTIONS: (PiiSensitivity | "all")[] = ["all", "none", "low", "medium", "high", "restricted"];

const C4_OPTIONS: (C4Level | "all")[] = ["all", ...ALL_C4_LEVELS];

const C4_LABELS: Record<C4Level | "all", string> = {
  all: "C4 Level",
  system: "System",
  container: "Container",
  component: "Component",
  code: "Code",
};

const SERVICE_CATALOG = Array.from(new Set(CATALOG.map((c) => c.id).filter((id) => id.includes("-")))).slice(0, 40);

export default function SearchFilter() {
  const canvasFilter = useGraphStore((s) => s.canvasFilter);
  const setCanvasFilter = useGraphStore((s) => s.setCanvasFilter);
  const saveView = useGraphStore((s) => s.saveView);
  const nodes = useGraphStore((s) => s.nodes);
  const [showSave, setShowSave] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewTags, setViewTags] = useState("");

  const handleSaveView = () => {
    const name = viewName.trim();
    if (!name) return;
    const tags = viewTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    saveView(name, tags);
    setViewName("");
    setViewTags("");
    setShowSave(false);
  };

  return (
    <div className="space-y-2 border-b border-white/10 px-3 py-3">
      <label className="relative block">
        <Search size={12} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
        <input
          className="w-full rounded-lg border border-white/10 bg-[#0d1219] py-1.5 pl-7 pr-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
          placeholder="Buscar nó, zona, tech, catalogId…"
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
        <select
          className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200"
          value={canvasFilter.catalogId}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, catalogId: e.target.value })}
        >
          <option value="">Catalogo (ID)</option>
          {SERVICE_CATALOG.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200"
          value={canvasFilter.piiSensitivity}
          onChange={(e) =>
            setCanvasFilter({ ...canvasFilter, piiSensitivity: e.target.value as PiiSensitivity | "all" })
          }
        >
          {PII_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "PII" : `PII: ${p}`}
            </option>
          ))}
        </select>
        <select
          className="col-span-2 rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200"
          value={canvasFilter.c4Level}
          onChange={(e) => setCanvasFilter({ ...canvasFilter, c4Level: e.target.value as C4Level | "all" })}
        >
          {C4_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {C4_LABELS[level]}
            </option>
          ))}
        </select>
      </div>

      {showSave && (
        <div className="space-y-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
          <input
            className="w-full rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200 outline-none"
            placeholder="Nome da view (ex: só PII + ads)"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveView()}
          />
          <input
            className="w-full rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-200 outline-none"
            placeholder="Tags (pii, ads, media…) separadas por vírgula"
            value={viewTags}
            onChange={(e) => setViewTags(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveView()}
          />
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 rounded bg-cyan-600/80 py-1 text-[10px] text-white hover:bg-cyan-500"
              onClick={handleSaveView}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
              onClick={() => setShowSave(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{nodes.length} nós no canvas</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
            onClick={() => setShowSave((v) => !v)}
          >
            <BookmarkPlus size={11} />
            Salvar view
          </button>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200"
            onClick={() => setCanvasFilter(EMPTY_CANVAS_FILTER)}
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
