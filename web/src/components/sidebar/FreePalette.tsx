"use client";

import { useState, useMemo } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { FREE_CATALOG, findFreeCatalog } from "@/lib/free-catalog";
import type { FreeNodeKind } from "@/lib/types";
import { Search, Zap } from "lucide-react";

// Categorias para agrupamento
const CATEGORIES: { id: string; label: string; kinds: FreeNodeKind[] }[] = [
  {
    id: "formas",
    label: "Formas",
    kinds: ["free-rectangle", "free-circle", "free-oval", "free-diamond", "free-triangle", "free-hexagon", "free-octagon"],
  },
  {
    id: "fluxo",
    label: "Fluxo",
    kinds: ["free-arrow-right", "free-arrow-double"],
  },
  {
    id: "estado",
    label: "Estado",
    kinds: ["free-check", "free-x", "free-plus"],
  },
  {
    id: "conteudo",
    label: "Conteúdo",
    kinds: ["free-image", "free-video", "free-audio", "free-note", "free-link"],
  },
  {
    id: "texto",
    label: "Texto",
    kinds: ["free-text", "free-edit"],
  },
];

export default function FreePalette() {
  const addFreeNode = useGraphStore((s) => s.addFreeNode);
  const nodes = useGraphStore((s) => s.nodes);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("formas");

  function placeShape(kind: FreeNodeKind) {
    // Posiciona em espiral para não sobrepor
    const offset = nodes.length * 20;
    const angle = nodes.length * 0.5;
    const radius = 50 + (nodes.length % 5) * 30;
    const x = 200 + Math.cos(angle) * radius + offset;
    const y = 140 + Math.sin(angle) * radius + offset;
    addFreeNode(kind, { x, y });
    const item = findFreeCatalog(kind);
    pushUiNotice({
      type: "success",
      text: `${item?.label ?? "Forma"} adicionada`,
    });
  }

  // Filtra itens baseado na busca
  const filteredItems = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => {
      const filteredKinds = cat.kinds.filter((kind) => {
        const item = findFreeCatalog(kind);
        return item?.label.toLowerCase().includes(q) ||
               item?.description.toLowerCase().includes(q) ||
               kind.toLowerCase().includes(q);
      });
      return { ...cat, kinds: filteredKinds };
    }).filter((cat) => cat.kinds.length > 0);
  }, [search]);

  // Itens da categoria ativa
  const activeCatItems = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
    return cat.kinds.map((kind) => findFreeCatalog(kind)).filter(Boolean);
  }, [activeCategory]);

  // Itens filtrados para busca
  const searchItems = useMemo(() => {
    if (!search.trim()) return [];
    return CATEGORIES.flatMap((cat) =>
      cat.kinds.map((kind) => findFreeCatalog(kind)).filter(Boolean)
    );
  }, [search]);

  const displayItems = search.trim() ? searchItems : activeCatItems;

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--surface-1)]"
      aria-label="Paleta de formas livres"
    >
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Formas</h2>
        <p className="mt-0.5 text-xs text-[var(--muted-fg)]">Clique para adicionar</p>
      </div>

      {/* Busca */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-fg)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar forma…"
            aria-label="Buscar forma"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pr-3 pl-8 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
          />
        </div>
      </div>

      {/* Categorias (só mostra se não estiver buscando) */}
      {!search && (
        <div className="flex border-b border-[var(--border)] overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 min-w-0 px-3 py-2 text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                  : "text-[var(--muted-fg)] hover:text-[var(--foreground)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-fg)]">
            {search ? `Resultados (${displayItems.length})` : CATEGORIES.find((c) => c.id === activeCategory)?.label}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {displayItems.map((item) => {
              if (!item) return null;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => placeShape(item.kind)}
                  className="group flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-2 text-center transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--accent-muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] min-h-[64px]"
                  title={item.description}
                  aria-label={`Adicionar ${item.label}`}
                >
                  <Icon className="h-5 w-5 text-[var(--foreground)] transition-transform group-hover:scale-110" />
                  <span className="text-[10px] font-medium text-[var(--muted-fg)] leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dica no rodapé */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        <p className="text-[10px] text-[var(--muted)]">
          <Zap className="inline h-3 w-3 mr-1" />
          Pressione <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted-fg)]">Delete</kbd> para remover
        </p>
        <p className="text-[10px] text-[var(--muted)] mt-1">
          Atalhos: <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted-fg)]">R</kbd> retângulo · <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted-fg)]">C</kbd> círculo · <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted-fg)]">D</kbd> losango
        </p>
      </div>
    </aside>
  );
}
