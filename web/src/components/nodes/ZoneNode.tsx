"use client";

import { NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { Layers, Shield } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { nodeOpacityForView } from "@/lib/architecture-view";
import { useGraphStore } from "@/lib/graph-store";
import { ZONE_META } from "@/lib/zones";
import type { ZoneNodeData } from "@/lib/types";

export default function ZoneNode({ id, data, selected }: NodeProps<Node<ZoneNodeData>>) {
  const architectureView = useGraphStore((s) => s.architectureView);
  const opacity = nodeOpacityForView(data, architectureView);
  const meta = ZONE_META[data.zoneKind];
  const Icon = data.zoneKind === "security_boundary" ? Shield : Layers;

  return (
    <div
      className={`relative h-full min-h-[160px] min-w-[240px] rounded-2xl border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] ${
        selected ? "ring-2 ring-indigo-400/60" : ""
      }`}
      style={{
        background: `linear-gradient(180deg, ${meta.bg} 0%, rgba(7,11,16,0.88) 42%)`,
        borderColor: selected ? "#22d3ee" : meta.border,
        borderStyle: data.zoneKind === "security_boundary" ? "solid" : "dashed",
        opacity,
      }}
    >
      <NodeResizer
        minWidth={240}
        minHeight={160}
        isVisible={selected}
        lineClassName="!border-[var(--accent)]/40"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-indigo-300 !bg-slate-950"
      />

      <AnchorHandle tone="block" nodeId={id} handleId="z-left" type="target" position={Position.Left} style={{ top: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="z-right" type="source" position={Position.Right} style={{ top: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="z-top" type="target" position={Position.Top} style={{ left: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="z-bottom" type="source" position={Position.Bottom} style={{ left: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="z-left-out" type="source" position={Position.Left} style={{ top: "35%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="z-right-in" type="target" position={Position.Right} style={{ top: "35%" }} />

      <header className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span
          className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: meta.bg, color: meta.accent }}
        >
          <Icon size={14} />
        </span>
        <div className="pointer-events-none min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-50">{data.label}</p>
          <p className="text-sm uppercase tracking-[0.14em]" style={{ color: meta.accent }}>
            Zona · {meta.short}
            {data.boundedContext ? ` · ${data.boundedContext}` : ""}
            {data.provider && data.provider !== "generic" ? ` · ${data.provider.toUpperCase()}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-[var(--border-strong)] bg-black/40 px-2 py-0.5 text-sm text-indigo-200 hover:border-[var(--accent)]/40"
          onClick={(e) => {
            e.stopPropagation();
            useGraphStore.getState().setFocusedZoneId(id);
          }}
        >
          Focar
        </button>
        {data.score != null && (
          <span className="rounded-md border border-[var(--border)] bg-black/30 px-2 py-0.5 text-sm font-semibold text-slate-200">
            {data.score.toFixed(1)}
          </span>
        )}
      </header>
      <div className="pointer-events-none mx-2.5 mb-2.5 min-h-[100px] rounded-xl border border-[var(--border)] bg-black/10" />
    </div>
  );
}
