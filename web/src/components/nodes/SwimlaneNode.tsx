"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { SWIMLANE_META, swimlaneKindOf } from "@/lib/swimlanes";
import type { SwimlaneNodeData } from "@/lib/types";

/** Swimlane horizontal para separar camadas (Frontend/Backend/Database) — P0.2.3. */
export default function SwimlaneNode({ id, data, selected }: NodeProps<Node<SwimlaneNodeData>>) {
  const swimlaneKind = swimlaneKindOf({ id, data, type: "swimlane" } as Node<SwimlaneNodeData>) ?? data.swimlaneKind;
  const meta = SWIMLANE_META[swimlaneKind];

  return (
    <article
      className={`relative h-full w-full rounded-xl border-2 border-dashed px-4 py-3 ${
        selected ? "ring-2 ring-indigo-400/70" : ""
      }`}
      style={{
        background: meta.bg,
        borderColor: meta.border,
        minWidth: 320,
        minHeight: 120,
      }}
      aria-label={`Swimlane ${data.label}`}
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "50%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "50%" }} />

      <div
        className="absolute left-0 top-0 flex h-full w-8 items-center justify-center rounded-l-xl text-[10px] font-bold uppercase tracking-widest"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          background: `${meta.accent}22`,
          color: meta.accent,
        }}
      >
        {meta.short}
      </div>
      <div className="pl-6">
        <p className="text-sm font-semibold" style={{ color: meta.accent }}>
          {data.label}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">Swimlane · arraste cards para dentro</p>
      </div>
    </article>
  );
}
