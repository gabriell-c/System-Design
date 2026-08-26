"use client";

import { useGraphStore } from "@/lib/graph-store";

/** Overlay visual para blast radius — usa estado do graph-store (sem DOM extra). */
export default function BlastRadiusOverlay() {
  const unreachable = useGraphStore((s) => s.blastUnreachableIds);
  const degraded = useGraphStore((s) => s.blastDegradedIds);
  const edges = useGraphStore((s) => s.blastHighlightEdgeIds);

  if (!unreachable.length && !degraded.length) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-20 left-4 z-20 max-w-xs rounded-xl border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-100 elev-2 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-rose-200">Blast radius</p>
      <p className="mt-1 text-rose-100/90">
        {unreachable.length} indisponível · {degraded.length} degradado · {edges.length} arestas afetadas
      </p>
    </div>
  );
}
