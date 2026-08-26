"use client";

import { NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { useGraphStore } from "@/lib/graph-store";
import type { ArchNodeData } from "@/lib/types";

function scoreTone(score?: number | null): string {
  if (score == null) return "bg-slate-700 text-slate-300";
  if (score >= 8) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 6) return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-rose-500/20 text-rose-200 border-rose-500/40";
}

export default function SagaNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const architectureView = useGraphStore((s) => s.architectureView);
  const opacity = architectureView === "all" || architectureView === "component" ? 1 : 0.35;

  return (
    <article
      className={`min-w-[220px] max-w-[260px] rounded-xl border px-3 py-2.5 elev-2 shadow-black/50 ${
        selected ? "ring-2 ring-violet-400/80" : "ring-1 ring-violet-500/40"
      }`}
      style={{
        background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, #121821 70%)",
        borderColor: "#7c3aed",
        opacity,
      }}
      title="Saga orchestrator — coordena transações distribuídas"
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "40%" }} />
      <AnchorHandle nodeId={id} handleId="left-out" type="source" position={Position.Left} style={{ top: "65%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "40%" }} />
      <AnchorHandle nodeId={id} handleId="right-in" type="target" position={Position.Right} style={{ top: "65%" }} />
      <AnchorHandle nodeId={id} handleId="top-out" type="source" position={Position.Top} style={{ left: "50%" }} />
      <AnchorHandle nodeId={id} handleId="bottom-out" type="source" position={Position.Bottom} style={{ left: "50%" }} />

      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/25 text-violet-200"
          aria-hidden
        >
          <Zap size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-violet-50">{data.label}</p>
          <p className="text-sm uppercase tracking-wide text-violet-300">Saga orchestrator</p>
          <p className="mt-1 truncate text-xs text-[var(--muted-fg)]">{data.tech}</p>
        </div>
        {data.score != null && (
          <span
            className={`rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums ${scoreTone(data.score)}`}
          >
            {data.score.toFixed(1)}
          </span>
        )}
      </div>
    </article>
  );
}
