"use client";

import { NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { Boxes, Link2 } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { KIND_META } from "@/lib/catalog";
import type { BlockNodeData } from "@/lib/types";

export default function BlockNode({ id, data, selected }: NodeProps<Node<BlockNodeData>>) {
  const meta = KIND_META[data.domain];

  return (
    <div
      className={`relative h-full min-h-[220px] min-w-[320px] rounded-2xl border-2 border-dashed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] ${
        selected ? "ring-2 ring-cyan-400/60" : ""
      }`}
      style={{
        background: `linear-gradient(180deg, ${meta.bg} 0%, rgba(7,11,16,0.92) 48%)`,
        borderColor: selected ? "#22d3ee" : meta.border,
      }}
    >
      <NodeResizer
        minWidth={320}
        minHeight={220}
        isVisible={selected}
        lineClassName="!border-cyan-400/40"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-cyan-300 !bg-slate-950"
      />

      <AnchorHandle tone="block" nodeId={id} handleId="b-left" type="target" position={Position.Left} style={{ top: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-right" type="source" position={Position.Right} style={{ top: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-top" type="target" position={Position.Top} style={{ left: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-bottom" type="source" position={Position.Bottom} style={{ left: "50%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-left-out" type="source" position={Position.Left} style={{ top: "35%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-right-in" type="target" position={Position.Right} style={{ top: "35%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-top-out" type="source" position={Position.Top} style={{ left: "35%" }} />
      <AnchorHandle tone="block" nodeId={id} handleId="b-bottom-in" type="target" position={Position.Bottom} style={{ left: "35%" }} />

      <header className="pointer-events-none flex items-center gap-2 px-4 pt-3 pb-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: meta.bg, color: meta.accent }}
        >
          <Boxes size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-50">{data.label}</p>
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: meta.accent }}>
            Bloco · {meta.label}
          </p>
        </div>
        {data.score != null && (
          <span className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
            {data.score.toFixed(1)}
          </span>
        )}
      </header>
      <p className="pointer-events-none flex items-center gap-1.5 px-4 pb-2 text-[11px] text-slate-400">
        <Link2 size={12} className="shrink-0 text-cyan-400/80" />
        Cards do mesmo domínio · duplo clique no ponto desfaz a linha
      </p>
      <div className="pointer-events-none mx-3 mb-3 min-h-[140px] rounded-xl border border-white/5 bg-black/15" />
    </div>
  );
}
