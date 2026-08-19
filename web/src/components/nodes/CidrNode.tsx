"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { Network } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import type { CidrNodeData } from "@/lib/types";

/** P0.3.5 — CIDR em VPC/subnet com overlap hint. */
export default function CidrNode({ id, data, selected }: NodeProps<Node<CidrNodeData>>) {
  const cidr = data.cidr ?? "10.0.0.0/16";

  return (
    <article
      className={`min-w-[180px] rounded-lg border border-dashed px-3 py-2 ${
        selected ? "ring-2 ring-teal-400/70" : ""
      }`}
      style={{ background: "rgba(20,184,166,0.08)", borderColor: "rgba(45,212,191,0.45)" }}
      aria-label={`CIDR ${cidr}`}
    >
      <AnchorHandle nodeId={id} handleId="in" type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Network size={14} className="text-teal-300" />
        <div>
          <p className="text-xs font-semibold text-teal-100">{data.label}</p>
          <p className="font-mono text-[11px] text-teal-300/90">{cidr}</p>
        </div>
      </div>
    </article>
  );
}
