"use client";

import { useGraphStore } from "@/lib/graph-store";
import { FREE_CATALOG, findFreeCatalog } from "@/lib/free-catalog";
import type { FreeNodeKind } from "@/lib/types";

export default function FreePalette() {
  const addFreeNode = useGraphStore((s) => s.addFreeNode);
  const nodes = useGraphStore((s) => s.nodes);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  function placeShape(kind: FreeNodeKind) {
    const offset = nodes.length * 24;
    addFreeNode(kind, { x: 200 + offset, y: 140 + offset });
    const item = findFreeCatalog(kind);
    pushUiNotice({
      type: "success",
      text: `${item?.label ?? "Forma"} adicionada.`,
    });
  }

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--surface-1)]"
      aria-label="Paleta de formas livres"
    >
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Formas</h2>
        <p className="mt-0.5 text-xs text-[var(--muted-fg)]">Clique para adicionar</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Seção: Formas básicas */}
        <div className="px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted-fg)]">
            Formas
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {FREE_CATALOG.filter((item) =>
              ["free-rectangle", "free-circle", "free-oval", "free-diamond", "free-triangle", "free-hexagon", "free-octagon"].includes(item.kind)
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => placeShape(item.kind)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-2 text-center transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  title={item.description}
                >
                  <Icon className="h-5 w-5 text-[var(--foreground)]" />
                  <span className="text-[10px] font-medium text-[var(--muted-fg)]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seção: Setas */}
        <div className="border-t border-[var(--border)] px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted-fg)]">
            Setas
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {FREE_CATALOG.filter((item) =>
              ["free-arrow-right", "free-arrow-double"].includes(item.kind)
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => placeShape(item.kind)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-2 text-center transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  title={item.description}
                >
                  <Icon className="h-5 w-5 text-[var(--foreground)]" />
                  <span className="text-[10px] font-medium text-[var(--muted-fg)]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seção: Indicadores */}
        <div className="border-t border-[var(--border)] px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted-fg)]">
            Indicadores
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {FREE_CATALOG.filter((item) =>
              ["free-check", "free-x", "free-plus"].includes(item.kind)
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => placeShape(item.kind)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-2 text-center transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  title={item.description}
                >
                  <Icon className="h-5 w-5 text-[var(--foreground)]" />
                  <span className="text-[10px] font-medium text-[var(--muted-fg)]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seção: Texto */}
        <div className="border-t border-[var(--border)] px-3 py-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted-fg)]">
            Texto
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {FREE_CATALOG.filter((item) =>
              ["free-text", "free-edit"].includes(item.kind)
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => placeShape(item.kind)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-2 text-center transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  title={item.description}
                >
                  <Icon className="h-5 w-5 text-[var(--foreground)]" />
                  <span className="text-[10px] font-medium text-[var(--muted-fg)]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
