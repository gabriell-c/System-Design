"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useGraphStore } from "@/lib/graph-store";
import type { NoteNodeData } from "@/lib/types";
/** P0.2.7 — Sticky note amarela no canvas. */
export default function NoteNode({ id, data, selected }: NodeProps<Node<NoteNodeData>>) {
  const updateNodeData = useGraphStore((s) => s.updateNodeData);

  return (
    <article
      className={`min-w-[160px] max-w-[240px] rounded-md border px-3 py-2 shadow-md ${
        selected ? "ring-2 ring-amber-400/80" : ""
      }`}
      style={{
        background: "linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)",
        borderColor: "#fbbf24",
        color: "#422006",
      }}
      aria-label={`Nota: ${data.label}`}
    >
      <textarea
        className="w-full resize-none bg-transparent text-xs font-medium leading-snug outline-none min-h-[48px]"
        value={data.text ?? data.label}
        onChange={(e) =>
          updateNodeData(id, { text: e.target.value, label: e.target.value.slice(0, 40) || "Nota" })
        }
        placeholder="Anotação do arquiteto…"
      />
      {data.anchorNodeId && (
        <p className="mt-1 text-[10px] opacity-60">↗ {data.anchorNodeId}</p>
      )}
    </article>
  );
}
