"use client";

import { Activity, Boxes, BookOpen, ChevronRight, Cloud, Database, Fingerprint, Layout, Plug, Plus, Search, Server, Workflow } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { KIND_META, CATALOG, findCatalog } from "@/lib/catalog";
import { useGraphStore } from "@/lib/graph-store";
import { TechIcon } from "@/lib/tech-icons";
import CatalogLibrary from "./CatalogLibrary";
import { ALL_NODE_KINDS, type NodeKind } from "@/lib/types";
import { useCatalogPrefs } from "@/hooks/useCatalogPrefs";
import RecommendationBanner from "@/components/canvas/RecommendationBanner";

const KINDS: NodeKind[] = ALL_NODE_KINDS;

const KIND_ICONS = {
  frontend: Layout,
  backend: Server,
  database: Database,
  cloud: Cloud,
  messaging: Workflow,
  identity: Fingerprint,
  observability: Activity,
  integration: Plug,
};

export default function ComponentPalette() {
  const [query, setQuery] = useState("");
  const addBlock = useGraphStore((s) => s.addBlock);
  const addCatalogNode = useGraphStore((s) => s.addCatalogNode);
  const nodes = useGraphStore((s) => s.nodes);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const { visibleCatalog, hasCustomPrefs, prefs, pinnedItems } = useCatalogPrefs();
  const recommendations = useGraphStore((s) => s.recommendations);
  const dismissRecommendations = useGraphStore((s) => s.dismissRecommendations);

  const q = query.trim().toLowerCase();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("archia-palette-collapsed");
      if (saved) return JSON.parse(saved) as Record<string, boolean>;
    } catch {
      /* ignore */
    }
    // Default: all card sections collapsed, blocks always open
    const init: Record<string, boolean> = {};
    for (const k of KINDS) init[k] = true;
    return init;
  });

  const toggleSection = useCallback((kind: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [kind]: !prev[kind] };
      try { localStorage.setItem("archia-palette-collapsed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // When searching, force all sections open
  const isSearching = q.length > 0;

  const filteredByKind = useMemo(() => {
    return KINDS.map((kind) => {
      const items = visibleCatalog.filter((item) => {
        if (item.kind !== kind) return false;
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q))
        );
      });
      return { kind, items };
    }).filter((section) => section.items.length > 0 || !q);
  }, [q, visibleCatalog]);

  function placeBlock(kind: NodeKind) {
    const offset = nodes.length * 28;
    addBlock(kind, { x: 120 + offset, y: 100 + offset });
    pushUiNotice({
      type: "success",
      text: `Bloco ${KIND_META[kind].label} adicionado. Agora solte cards do mesmo tipo dentro dele.`,
    });
  }

function placeCard(catalogId: string) {
    const item = findCatalog(catalogId);
    if (!item) return;
    const offset = nodes.length * 20;
    addCatalogNode(catalogId, { x: 280 + offset, y: 160 + offset });
  }

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-white/8 bg-[#0d1219]"
      aria-label="Paleta de componentes"
    >
      <div className="border-b border-white/8 px-3 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Paleta</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Clique para adicionar ou arraste até o canvas.
            </p>
          </div>
          {!isSearching && (
            <button
              type="button"
              className="shrink-0 rounded-md px-1.5 py-1 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
              onClick={() => {
                const allOpen = KINDS.every((k) => !collapsed[k]);
                const next: Record<string, boolean> = {};
                for (const k of KINDS) next[k] = allOpen; // toggle: if all open → collapse all, else expand all
                setCollapsed(next);
                try { localStorage.setItem("archia-palette-collapsed", JSON.stringify(next)); } catch { /* ignore */ }
              }}
              title="Expandir ou recolher todas as seções"
            >
              {KINDS.every((k) => !collapsed[k]) ? "Recolher" : "Expandir"}
            </button>
          )}
        </div>
        <label className="relative mt-3 block">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar React, Python, Docker…"
            className="w-full rounded-lg border border-white/10 bg-[#0a0f16] py-2 pl-8 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            aria-label="Buscar na paleta"
          />
        </label>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Library button */}
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 text-left transition hover:bg-cyan-500/10"
        >
          <BookOpen size={14} className="text-cyan-400" />
          <span className="flex-1">
            <span className="block text-xs font-medium text-slate-100">Biblioteca completa</span>
            <span className="block text-[10px] text-slate-500">
              {hasCustomPrefs ? `${prefs.visibleIds.length} de ${CATALOG.length} selecionados` : `${CATALOG.length} componentes`}
            </span>
          </span>
        </button>

        {/* Pinned items */}
        {pinnedItems.length > 0 && !q && (
          <section aria-labelledby="palette-pinned">
            <h3
              id="palette-pinned"
              className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300"
            >
              ⭐ Fixados
            </h3>
            <ul className="space-y-1.5">
              {pinnedItems.map((item) => (
                <li key={`pin-${item.id}`}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/system-design", item.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => placeCard(item.id)}
                    className="flex w-full cursor-grab items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left transition hover:border-amber-500/30 hover:bg-amber-500/10 active:cursor-grabbing"
                  >
                    <TechIcon
                      catalogId={item.id}
                      kind={item.kind}
                      size={16}
                      className="mt-0.5 shrink-0 text-amber-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-100">{item.label}</span>
                      <span className="block text-xs text-slate-500">{item.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(!q || KINDS.some((k) => KIND_META[k].label.toLowerCase().includes(q))) && (
          <section aria-labelledby="palette-blocks">
            <h3
              id="palette-blocks"
              className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300"
            >
              <Boxes size={12} />
              Passo 1 · Blocos
            </h3>
            <ul className="grid grid-cols-2 gap-1.5">
              {KINDS.filter((kind) => !q || KIND_META[kind].label.toLowerCase().includes(q)).map((kind) => {
                const meta = KIND_META[kind];
                const Icon = KIND_ICONS[kind];
                return (
                  <li key={`block-${kind}`}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/system-design-block", kind);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => placeBlock(kind)}
                      className="flex w-full cursor-grab flex-col items-start gap-1 rounded-xl border border-dashed px-2.5 py-2.5 text-left transition hover:bg-white/5 active:cursor-grabbing"
                      style={{ borderColor: meta.border, background: meta.bg }}
                      title="Clique para adicionar · arraste para posicionar"
                    >
                      <span className="flex w-full items-center justify-between">
                        <Icon size={14} style={{ color: meta.accent }} />
                        <Plus size={12} className="text-slate-500" />
                      </span>
                      <span className="text-xs font-semibold text-slate-100">{meta.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {filteredByKind.map(({ kind, items }, index) => {
          if (items.length === 0) return null;
          const meta = KIND_META[kind];
          const SectionIcon = KIND_ICONS[kind];
          const isCollapsed = !isSearching && collapsed[kind];
          return (
            <section key={kind} aria-labelledby={`palette-${kind}`}>
              <button
                type="button"
                id={`palette-${kind}`}
                onClick={() => toggleSection(kind)}
                className="mb-2 flex w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wider transition hover:bg-white/5"
                style={{ color: meta.accent }}
              >
                <ChevronRight
                  size={12}
                  className="shrink-0 transition-transform duration-150"
                  style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                />
                <SectionIcon size={12} />
                <span className="flex-1">
                  {meta.label}
                </span>
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-normal leading-none text-slate-400">
                  {items.length}
                </span>
              </button>
              {!isCollapsed && (
                <ul className="space-y-1.5 pl-0.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("application/system-design", item.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => placeCard(item.id)}
                        className="flex w-full cursor-grab items-start gap-2 rounded-lg border border-white/8 bg-[#121821] px-3 py-2 text-left transition hover:border-white/20 hover:bg-[#171f2b] active:cursor-grabbing"
                        title="Clique para adicionar · arraste para dentro do bloco"
                      >
                        <TechIcon
                          catalogId={item.id}
                          kind={kind}
                          size={16}
                          className="mt-0.5 shrink-0"
                          style={{ color: meta.accent }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-100">{item.label}</span>
                          <span className="block text-xs text-slate-500">{item.description}</span>
                        </span>
                        <Plus size={12} className="mt-1 shrink-0 text-slate-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {q && filteredByKind.every((s) => s.items.length === 0) && (
          <p className="px-1 text-xs text-slate-500">Nada encontrado para “{query}”.</p>
        )}
      </div>
      {/* AI Recommendation */}
      {recommendations.length > 0 && (
        <RecommendationBanner
          recommendations={recommendations}
          onAccept={(recommendedId) => {
            dismissRecommendations();
            placeCard(recommendedId);
          }}
          onDismiss={dismissRecommendations}
        />
      )}

      <CatalogLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </aside>
  );
}
