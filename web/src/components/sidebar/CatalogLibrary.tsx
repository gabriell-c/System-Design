"use client";

import {
  BookOpen, Check, ChevronDown, ChevronRight, Pin, RotateCcw,
  Search, Star, X, CheckSquare, Square, Layout, Server, Database,
  Cloud, Workflow, Plug, Smartphone, Boxes, Monitor, Shield,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { KIND_META, CATALOG } from "@/lib/catalog";
import { TechIcon } from "@/lib/tech-icons";
import type { CatalogCategory, NodeKind } from "@/lib/types";
import { ALL_NODE_KINDS } from "@/lib/types";
import { ScrollCarousel } from "@/components/ui/ScrollCarousel";
import { CATEGORY_LABELS, groupCatalog, useCatalogPrefs } from "@/hooks/useCatalogPrefs";

const KIND_TAB_ICONS: Record<string, typeof Layout> = {
  all: Boxes, frontend: Smartphone, backend: Server, database: Database,
  cloud: Cloud, messaging: Workflow, identity: Shield, observability: Monitor, integration: Plug,
};

const KIND_TABS: { value: NodeKind | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  ...ALL_NODE_KINDS.map((k) => ({ value: k, label: KIND_META[k].label })),
];

const CAT_TABS: { value: CatalogCategory | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "language", label: "Linguagens" },
  { value: "framework", label: "Frameworks" },
  { value: "library", label: "Bibliotecas" },
  { value: "service", label: "Servicos" },
  { value: "database", label: "Bancos" },
  { value: "platform", label: "Plataformas" },
  { value: "tool", label: "Ferramentas" },
];

type Props = { open: boolean; onClose: () => void };

export default function CatalogLibrary({ open, onClose }: Props) {
  const { prefs, hasCustomPrefs, toggleVisible, setVisible, togglePin, addAllOfKind, removeAllOfKind, resetToDefaults } = useCatalogPrefs();

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<NodeKind | "all">("all");
  const [catFilter, setCatFilter] = useState<CatalogCategory | "all">("all");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set(ALL_NODE_KINDS));

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let items = CATALOG;
    if (kindFilter !== "all") items = items.filter((i) => i.kind === kindFilter);
    if (catFilter !== "all") items = items.filter((i) => i.category === catFilter);
    if (q) {
      items = items.filter((i) =>
        i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) ||
        i.tech.toLowerCase().includes(q) || i.tags?.some((t) => t.toLowerCase().includes(q)) ||
        i.id.toLowerCase().includes(q),
      );
    }
    if (showOnlySelected && hasCustomPrefs) {
      const set = new Set(prefs.visibleIds);
      items = items.filter((i) => set.has(i.id));
    }
    return items;
  }, [q, kindFilter, catFilter, showOnlySelected, hasCustomPrefs, prefs.visibleIds]);

  const groups = useMemo(() => groupCatalog(filtered), [filtered]);
  const visibleSet = useMemo(() => new Set(prefs.visibleIds), [prefs.visibleIds]);
  const pinnedSet = useMemo(() => new Set(prefs.pinnedIds), [prefs.pinnedIds]);

  const selectedCount = prefs.visibleIds.length;
  const totalCount = CATALOG.length;

  const allVisible = useMemo(() => filtered.length > 0 && filtered.every((i) => visibleSet.has(i.id)), [filtered, visibleSet]);
  const someVisible = useMemo(() => filtered.some((i) => visibleSet.has(i.id)), [filtered, visibleSet]);

  const toggleAllVisible = useCallback(() => {
    if (allVisible) {
      const ids = prefs.visibleIds.filter((id) => !filtered.some((i) => i.id === id));
      setVisible(ids);
    } else {
      const ids = [...prefs.visibleIds, ...filtered.filter((i) => !prefs.visibleIds.includes(i.id)).map((i) => i.id)];
      setVisible(ids);
    }
  }, [allVisible, filtered, prefs.visibleIds, setVisible]);

  const toggleKindExpand = useCallback((kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-[88vh] w-[800px] flex-col rounded-2xl border border-white/10 bg-[#0d1219] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Biblioteca de componentes</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {hasCustomPrefs ? `${selectedCount}/${totalCount} na sua palete` : `${totalCount} disponiveis`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasCustomPrefs && filtered.length > 0 && (allVisible || !someVisible) && (
              <button
                type="button"
                onClick={toggleAllVisible}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                  allVisible
                    ? "border-amber-400/30 text-amber-400 hover:bg-amber-500/10"
                    : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {allVisible ? <CheckSquare size={13} /> : <Square size={13} />}
                {allVisible ? "Desselecionar todos" : "Selecionar todos"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-2">
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar React, Python, Docker..."
              className="w-full rounded-xl border border-white/10 bg-[#0a0f16] py-2.5 pl-9 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            />
          </label>
        </div>

        {/* Domain tabs */}
        <ScrollCarousel className="pb-2" padLeft={24}>
          {KIND_TABS.map((kt) => {
            const Icon = KIND_TAB_ICONS[kt.value] ?? Boxes;
            const active = kindFilter === kt.value;
            return (
              <button
                key={kt.value}
                type="button"
                onClick={() => setKindFilter(kt.value)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon size={15} />
                {kt.label}
              </button>
            );
          })}
        </ScrollCarousel>

        {/* Category select + filter */}
        <div className="flex items-center gap-3 px-6 pb-3">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as CatalogCategory | "all")}
            className="appearance-none rounded-xl border border-white/10 bg-[#0a0f16] px-3 py-2 pr-8 text-[12px] font-semibold text-slate-200 outline-none cursor-pointer focus:border-purple-400/50"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            {CAT_TABS.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
          <label className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={showOnlySelected}
              onChange={(e) => setShowOnlySelected(e.target.checked)}
              className="rounded border-white/20 accent-cyan-400"
            />
            So selecionados
          </label>
        </div>

        {/* Catalog list */}
        <div className="custom-scroll flex-1 overflow-y-auto px-6 py-2">
          {groups.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">Nenhum componente encontrado.</p>
          )}

          {groups.map((group) => {
            const meta = KIND_META[group.kind];
            const isExpanded = expandedKinds.has(group.kind);
            const showAccordion = groups.length > 1;
            return (
              <div key={group.kind} className="mb-3">
                {showAccordion ? (
                  <button
                    type="button"
                    onClick={() => toggleKindExpand(group.kind)}
                    className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-white/5"
                  >
                    {isExpanded ? <ChevronDown size={14} style={{ color: meta.accent }} /> : <ChevronRight size={14} style={{ color: meta.accent }} />}
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.accent }}>{meta.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
                      {group.categories.reduce((acc, c) => acc + c.items.length, 0)}
                    </span>
                    {hasCustomPrefs && (
                      <>
                        <span className="ml-auto text-[10px] text-slate-600">
                          {group.categories.reduce((acc, c) => acc + c.items.filter((i) => visibleSet.has(i.id)).length, 0)} sel.
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const all = group.categories.every((c) => c.items.every((i) => visibleSet.has(i.id)));
                            if (all) removeAllOfKind(group.kind); else addAllOfKind(group.kind);
                          }}
                          className="ml-1 rounded-md px-2 py-0.5 text-[10px] text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
                        >
                          {group.categories.every((c) => c.items.every((i) => visibleSet.has(i.id))) ? "Desmarcar" : "Marcar"}
                        </button>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.accent }}>{meta.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
                      {group.categories.reduce((acc, c) => acc + c.items.length, 0)}
                    </span>
                    {hasCustomPrefs && (
                      <span className="ml-auto text-[10px] text-slate-600">
                        {group.categories.reduce((acc, c) => acc + c.items.filter((i) => visibleSet.has(i.id)).length, 0)} selecionados
                      </span>
                    )}
                  </div>
                )}

                {(isExpanded || !showAccordion) && (
                  <div className="space-y-4 pl-2">
                    {group.categories.map((catGroup) => (
                      <div key={catGroup.category}>
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span>{CATEGORY_LABELS[catGroup.category] ?? catGroup.category}</span>
                          <span className="rounded bg-white/5 px-1 text-[9px] text-slate-600">{catGroup.items.length}</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {catGroup.items.map((item) => {
                            const isSelected = visibleSet.has(item.id);
                            const isPinned = pinnedSet.has(item.id);
                            return (
                              <div
                                key={item.id}
                                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                                  isSelected
                                    ? "border-white/15 bg-[#141c28]"
                                    : "border-white/5 bg-transparent opacity-55 hover:opacity-80"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleVisible(item.id)}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                                    isSelected
                                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                                      : "border-white/15 bg-transparent text-transparent hover:border-white/30"
                                  }`}
                                >
                                  {isSelected && <Check size={13} strokeWidth={3} />}
                                </button>

                                <TechIcon catalogId={item.id} kind={item.kind} size={20} className="shrink-0" style={{ color: meta.accent }} />

                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-slate-100">{item.label}</span>
                                    {item.popularity && item.popularity >= 8 && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                        <Star size={8} /> popular
                                      </span>
                                    )}
                                  </span>
                                  <span className="block text-[11px] leading-tight text-slate-500">{item.description}</span>
                                </span>

                                {hasCustomPrefs && (
                                  <button
                                    type="button"
                                    onClick={() => togglePin(item.id)}
                                    className={`shrink-0 rounded-lg p-1.5 transition ${
                                      isPinned ? "text-amber-400 hover:bg-amber-500/15" : "text-slate-700 hover:bg-white/5 hover:text-slate-400 opacity-0 group-hover:opacity-100"
                                    }`}
                                    title={isPinned ? "Desafixar" : "Fixar no topo"}
                                  >
                                    <Pin size={13} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {hasCustomPrefs && (
          <div className="border-t border-white/8 px-6 py-3">
            <button
              type="button"
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              <RotateCcw size={12} />
              Mostrar todos novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
