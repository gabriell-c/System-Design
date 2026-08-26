"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { Share2 } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { useGraphStore } from "@/lib/graph-store";
import type { ArchNodeData } from "@/lib/types";

export default function TransitGatewayNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const attachments = data.tgwAttachments ?? [];
  const blastUnreachable = useGraphStore((s) => s.blastUnreachableIds);
  const inBlast = blastUnreachable.includes(id);

  return (
    <article
      className={`min-w-[240px] max-w-[300px] rounded-xl border px-3 py-2.5 elev-2 ${
        selected ? "ring-2 ring-violet-400/80" : ""
      } ${inBlast ? "ring-2 ring-rose-500/70" : ""}`}
      style={{
        background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, #121821 75%)",
        borderColor: "rgba(167, 139, 250, 0.55)",
      }}
      aria-label={`Transit Gateway ${data.label}, ${attachments.length} attachments`}
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "35%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "35%" }} />
      <AnchorHandle nodeId={id} handleId="bottom-out" type="source" position={Position.Bottom} style={{ left: "50%" }} />

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200">
          <Share2 size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-violet-50">{data.label}</p>
          <p className="text-sm uppercase tracking-wide text-violet-300/90">Transit Gateway Hub</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--muted-fg)]">
            {attachments.length === 0 ? (
              <li>Hub central — conecte VPC attachments</li>
            ) : (
              attachments.slice(0, 4).map((a, i) => (
                <li key={i}>
                  {a.vpc_label ?? a.vpc_id}
                  {a.route_table ? ` · RT ${a.route_table}` : ""}
                </li>
              ))
            )}
            {attachments.length > 4 ? <li>+{attachments.length - 4} attachments</li> : null}
          </ul>
        </div>
      </div>
    </article>
  );
}
