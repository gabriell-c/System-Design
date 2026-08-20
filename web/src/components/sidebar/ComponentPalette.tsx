"use client";

import { Activity, Boxes, BookOpen, ChevronRight, Cloud, Database, Fingerprint, HeartPulse, Layers, Layout, Network, Plug, Plus, Rocket, Search, Server, Share2, Shield } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { KIND_META, CATALOG, findCatalog } from "@/lib/catalog";
import { useGraphStore } from "@/lib/graph-store";
import { TechIcon } from "@/lib/tech-icons";
import CatalogLibrary from "./CatalogLibrary";
import { ALL_NODE_KINDS, ALL_SWIMLANE_KINDS, ALL_ZONE_KINDS, type CloudProvider, type NodeKind, type SwimlaneKind, type ZoneKind } from "@/lib/types";
import { SWIMLANE_META } from "@/lib/swimlanes";
import { useCatalogPrefs } from "@/hooks/useCatalogPrefs";
import RecommendationBanner from "@/components/canvas/RecommendationBanner";
import { ZONE_META } from "@/lib/zones";
import { PATTERNS_CATALOG } from "@/lib/catalog-patterns";
import { applyPattern } from "@/lib/pattern-apply";

const KINDS: NodeKind[] = ALL_NODE_KINDS;
const ZONE_ICONS: Record<ZoneKind, typeof Layers> = {
  region: Cloud,
  vpc: Layers,
  availability_zone: Server,
  subnet_public: Layout,
  subnet_private: Database,
  layer: Layers,
  plane: Boxes,
  security_boundary: Shield,
  peering: Share2,
  vpn: Shield,
  privatelink: Plug,
  express_route: Rocket,
  data_mesh: Database,
  tgw: Share2,
  nat_gateway: Server,
  prefix_list: Boxes,
  dr_region: HeartPulse,
  observability: Activity,
};

const KIND_ICONS: Record<NodeKind, typeof Layout> = {
  frontend: Layout,
  backend: Server,
  database: Database,
  cloud: Cloud,
  identity: Fingerprint,
  observability: Activity,
  integration: Plug,
  deploy: Rocket,
  security: Shield,
  network: Network,
};

export default function ComponentPalette() {
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<CloudProvider | "all">("all");
  const addBlock = useGraphStore((s) => s.addBlock);
  const addZone = useGraphStore((s) => s.addZone);
  const addSwimlane = useGraphStore((s) => s.addSwimlane);
  const addNote = useGraphStore((s) => s.addNote);
  const addCidrBlock = useGraphStore((s) => s.addCidrBlock);
  const addTenantBoundary = useGraphStore((s) => s.addTenantBoundary);
  const addCatalogNode = useGraphStore((s) => s.addCatalogNode);
  const addPatternNodes = useGraphStore((s) => s.addPatternNodes);
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
        if (providerFilter !== "all") {
          const p = item.provider ?? item.defaults.provider;
          if (p && p !== providerFilter && p !== "generic") return false;
          if (providerFilter !== "generic" && !p && !item.tags?.some((t) => t.includes(providerFilter))) {
            // keep stack items without provider always visible
            if (["frontend", "backend"].includes(kind)) {
              /* ok */
            } else if (kind === "cloud" || kind === "identity" || kind === "integration" || kind === "observability" || kind === "database") {
              if (!item.id.includes(providerFilter) && !item.tech.toLowerCase().includes(providerFilter)) return false;
            }
          }
        }
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.capability?.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q))
        );
      });
      return { kind, items };
    }).filter((section) => section.items.length > 0 || !q);
  }, [q, visibleCatalog, providerFilter]);

  function placeBlock(kind: NodeKind) {
    const offset = nodes.length * 28;
    addBlock(kind, { x: 120 + offset, y: 100 + offset });
    pushUiNotice({
      type: "success",
      text: `Bloco ${KIND_META[kind].label} adicionado.`,
    });
  }

  function placeSwimlane(kind: SwimlaneKind) {
    const offset = nodes.length * 20;
    addSwimlane(kind, { x: 40 + offset, y: 80 + offset });
    pushUiNotice({
      type: "success",
      text: `Swimlane ${SWIMLANE_META[kind].label} adicionada.`,
    });
  }

  function placeZone(kind: ZoneKind) {
    const offset = nodes.length * 24;
    addZone(kind, { x: 60 + offset, y: 40 + offset });
    pushUiNotice({
      type: "success",
      text: `Zona ${ZONE_META[kind].label} adicionada. Solte serviços ou sub-zonas dentro.`,
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
            placeholder="Buscar React, Lambda, VPC…"
            className="w-full rounded-lg border border-white/10 bg-[#0a0f16] py-2 pl-8 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            aria-label="Buscar na paleta"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["all", "aws", "azure", "gcp"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProviderFilter(p)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                providerFilter === p
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "bg-white/5 text-slate-500 hover:text-slate-300"
              }`}
            >
              {p === "all" ? "Todos" : p}
            </button>
          ))}
        </div>
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

        {(!q || "zona region vpc az".includes(q)) && (
          <section aria-labelledby="palette-zones">
            <h3
              id="palette-zones"
              className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-violet-300"
            >
              <Layers size={12} />
              Zonas de arquitetura
            </h3>
            <ul className="grid grid-cols-2 gap-1.5">
              {ALL_ZONE_KINDS.map((kind) => {
                const meta = ZONE_META[kind];
                const Icon = ZONE_ICONS[kind];
                return (
                  <li key={`zone-${kind}`}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/system-design-zone", kind);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => placeZone(kind)}
                      className="flex w-full cursor-grab flex-col items-start gap-1 rounded-xl border border-dashed px-2.5 py-2.5 text-left transition hover:bg-white/5 active:cursor-grabbing"
                      style={{ borderColor: meta.border, background: meta.bg }}
                      title="Zona aninhável (VPC → AZ → Subnet)"
                    >
                      <span className="flex w-full items-center justify-between">
                        <Icon size={14} style={{ color: meta.accent }} />
                        <Plus size={12} className="text-slate-500" />
                      </span>
                      <span className="text-xs font-semibold text-slate-100">{meta.short}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(!q || "swimlane frontend backend database dev user".includes(q)) && (
          <section aria-labelledby="palette-swimlanes">
            <h3
              id="palette-swimlanes"
              className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-300"
            >
              <Layout size={12} />
              Swimlanes (camadas)
            </h3>
            <ul className="grid grid-cols-2 gap-1.5">
              {ALL_SWIMLANE_KINDS.map((kind) => {
                const meta = SWIMLANE_META[kind];
                return (
                  <li key={`lane-${kind}`}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/system-design-swimlane", kind);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => placeSwimlane(kind)}
                      className="flex w-full cursor-grab flex-col items-start gap-1 rounded-xl border border-dashed px-2.5 py-2.5 text-left transition hover:bg-white/5 active:cursor-grabbing"
                      style={{ borderColor: meta.border, background: meta.bg }}
                      title="Faixa horizontal para separar camadas ou fluxos"
                    >
                      <span className="flex w-full items-center justify-between">
                        <Layout size={14} style={{ color: meta.accent }} />
                        <Plus size={12} className="text-slate-500" />
                      </span>
                      <span className="text-xs font-semibold text-slate-100">{meta.short}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(!q || "nota cidr tenant sticky".includes(q)) && (
          <section aria-labelledby="palette-annotations">
            <h3 id="palette-annotations" className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
              Anotações & multi-tenant
            </h3>
            <ul className="grid grid-cols-1 gap-1.5">
              <li>
                <button type="button" className="btn-ghost w-full justify-start text-xs" onClick={() => addNote({ x: 120, y: 120 })}>
                  Sticky note
                </button>
              </li>
              <li>
                <button type="button" className="btn-ghost w-full justify-start text-xs" onClick={() => addCidrBlock({ x: 160, y: 160 })}>
                  CIDR block
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="btn-ghost w-full justify-start text-xs"
                  onClick={() => addTenantBoundary({ x: 200, y: 200 }, { tenantMode: "silo" })}
                >
                  Tenant boundary
                </button>
              </li>
            </ul>
          </section>
        )}

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

        <section className="mt-4 border-t border-white/8 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-300">Patterns</p>
          <ul className="space-y-1.5">
            {PATTERNS_CATALOG.filter((p) => ["pat-saga", "pat-outbox", "pat-cqrs", "pat-event-driven"].includes(p.id)).map(
              (pat) => (
                <li key={pat.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-left text-xs text-slate-200 hover:bg-violet-500/20"
                    onClick={() => {
                      const pos = { x: 120 + nodes.length * 24, y: 120 + nodes.length * 12 };
                      addPatternNodes(applyPattern(pat.id, pos));
                      pushUiNotice({ type: "success", text: `Pattern ${pat.label} aplicado.` });
                    }}
                  >
                    {pat.label}
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
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
