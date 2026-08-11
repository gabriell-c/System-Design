"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { KIND_META } from "@/lib/catalog";
import { TechIcon } from "@/lib/tech-icons";
import type { ArchNodeData } from "@/lib/types";

function scoreTone(score?: number | null): string {
  if (score == null) return "bg-slate-700 text-slate-300";
  if (score >= 8) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 6) return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-rose-500/20 text-rose-200 border-rose-500/40";
}

export default function ArchNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const meta = KIND_META[data.kind];
  const subtitle =
    data.config.framework ||
    data.config.engine ||
    [data.config.provider, data.config.service].filter(Boolean).join(" · ") ||
    data.tech;

  return (
    <article
      className={`min-w-[210px] max-w-[240px] rounded-xl border px-3 py-2.5 shadow-lg shadow-black/40 ${
        selected ? "ring-2 ring-cyan-400/70" : ""
      }`}
      style={{ background: "#121821", borderColor: meta.border }}
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "40%" }} />
      <AnchorHandle nodeId={id} handleId="left-out" type="source" position={Position.Left} style={{ top: "65%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "40%" }} />
      <AnchorHandle nodeId={id} handleId="right-in" type="target" position={Position.Right} style={{ top: "65%" }} />
      <AnchorHandle nodeId={id} handleId="top-in" type="target" position={Position.Top} style={{ left: "40%" }} />
      <AnchorHandle nodeId={id} handleId="top-out" type="source" position={Position.Top} style={{ left: "65%" }} />
      <AnchorHandle nodeId={id} handleId="bottom-out" type="source" position={Position.Bottom} style={{ left: "40%" }} />
      <AnchorHandle nodeId={id} handleId="bottom-in" type="target" position={Position.Bottom} style={{ left: "65%" }} />

      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: meta.bg, color: meta.accent }}
          aria-hidden
        >
          <TechIcon catalogId={data.catalogId} kind={data.kind} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-100">{data.label}</p>
            {data.score != null && (
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${scoreTone(data.score)}`}
                title="Nota heurística do node"
              >
                {data.score.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: meta.accent }}>
            {meta.label}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}
