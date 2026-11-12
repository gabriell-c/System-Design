"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";

/** S3b (item 3b) — quantas linhas de label o overlay mostra. */
const BLAST_LABELS_SHOWN = 5;

type LabelRow = {
  id: string;
  label: string;
  kind: "unreachable" | "degraded";
};

/**
 * Overlay visual para blast radius — lê estado do graph-store.
 *
 * S3b (items 66/67) — rulings:
 * - FECHAMENTO: botão X + Esc. SEM auto-expire (o resultado de
 *   apresentação não pode somar sozinho; o usuário tem o X, o Esc e o
 *   "Limpar highlight" do painel de resiliência).
 * - Esc é ignorado quando o app está em tela cheia (Esc reserva a
 *   saída de fullscreen).
 * - `blastEdgeIds`/`blastLabels` (S3a): arestas/rótulos da INJEÇÃO —
 *   independência do "Caminho crítico" (`blastHighlightEdgeIds`,
 *   analysis-slice), que este overlay não lê mais.
 * - jump por label: mesmo mecanismo de `focusCanvasNode` do
 *   DesignCanvas (wrapper `.react-flow__node[data-id]` + elemento com
 *   tabindex) + scrollIntoView. O painel segue `pointer-events:none`;
 *   apenas os elementos interativos recebem `pointer-events:auto`.
 */
export default function BlastRadiusOverlay() {
  const unreachableIds = useGraphStore((s) => s.blastUnreachableIds);
  const degradedIds = useGraphStore((s) => s.blastDegradedIds);
  const edgeIds = useGraphStore((s) => s.blastEdgeIds);
  const blastLabels = useGraphStore((s) => s.blastLabels);
  const clearBlastRadiusHighlight = useGraphStore((s) => s.clearBlastRadiusHighlight);

  const visible = unreachableIds.length > 0 || degradedIds.length > 0;

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        clearBlastRadiusHighlight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, clearBlastRadiusHighlight]);

  // Rótulos do store são PARALELOS aos ids (o painel os mapeia na mesma
  // ordem: `unreachable.map(labelOf)`) → o índice i de `blastLabels.
  // unreachable[i]` é `unreachableIds[i]`.
  const rows = useMemo<LabelRow[]>(() => {
    if (!blastLabels) return [];
    const result: LabelRow[] = [];
    blastLabels.unreachable.forEach((label, i) => {
      const id = unreachableIds[i];
      if (id != null && result.length < BLAST_LABELS_SHOWN) {
        result.push({ id, label, kind: "unreachable" });
      }
    });
    blastLabels.degraded.forEach((label, i) => {
      const id = degradedIds[i];
      if (id != null && result.length < BLAST_LABELS_SHOWN) {
        result.push({ id, label, kind: "degraded" });
      }
    });
    return result;
  }, [blastLabels, unreachableIds, degradedIds]);

  if (!visible) return null;

  function jumpTo(id: string) {
    // Mesmo mecanismo de DesignCanvas.focusCanvasNode (P4.4b).
    const wrapper = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
    if (!wrapper) return;
    wrapper.scrollIntoView({ block: "center", behavior: "smooth" });
    (wrapper.querySelector<HTMLElement>('[tabindex="0"]') ?? wrapper).focus();
  }

  return (
    <div
      className="pointer-events-none absolute bottom-20 left-4 z-20 max-w-xs rounded-xl border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-100 elev-2 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-rose-200">Blast radius</p>
        <button
          type="button"
          className="pointer-events-auto -m-1 rounded p-1 text-rose-200 transition hover:bg-rose-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          onClick={clearBlastRadiusHighlight}
          aria-label="Fechar resumo de blast radius (Esc)"
          title="Fechar (Esc)"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-rose-100/90">
        {unreachableIds.length} indisponível · {degradedIds.length} degradado · {edgeIds.length} arestas afetadas
      </p>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {rows.map((row) => (
            <li key={`${row.kind}:${row.id}`}>
              <button
                type="button"
                className="pointer-events-auto block w-full truncate rounded px-1 py-0.5 text-left text-rose-100 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                onClick={() => jumpTo(row.id)}
                aria-label={`Ir para o nó ${row.kind === "unreachable" ? "indisponível" : "degradado"} ${row.label}`}
              >
                {row.kind === "unreachable" ? "✕" : "≈"} {row.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
