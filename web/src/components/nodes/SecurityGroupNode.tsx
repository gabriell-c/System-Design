"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { Shield } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { useGraphStore } from "@/lib/graph-store";
import type { ArchNodeData } from "@/lib/types";

export default function SecurityGroupNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const rules = data.securityGroupRules ?? [];
  const blastUnreachable = useGraphStore((s) => s.blastUnreachableIds);
  const inBlast = blastUnreachable.includes(id);

  return (
    <article
      className={`min-w-[220px] max-w-[280px] rounded-xl border px-3 py-2.5 elev-2 ${
        selected ? "ring-2 ring-pink-400/80" : ""
      } ${inBlast ? "ring-2 ring-rose-500/70" : ""}`}
      style={{
        background: "linear-gradient(135deg, rgba(236,72,153,0.12) 0%, #121821 75%)",
        borderColor: "rgba(244, 114, 182, 0.55)",
      }}
      aria-label={`Security group ${data.label}, ${rules.length} regras`}
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "40%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "40%" }} />

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-pink-200">
          <Shield size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-pink-50">{data.label}</p>
          <p className="text-sm uppercase tracking-wide text-pink-300/90">Security Group / NSG</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--muted-fg)]">
            {rules.length === 0 ? (
              <li>Sem regras — adicione no inspetor</li>
            ) : (
              rules.slice(0, 4).map((r, i) => (
                <li key={i}>
                  {r.direction} {r.protocol}:{r.port}
                  {r.description ? ` (${r.description})` : ""}
                </li>
              ))
            )}
            {rules.length > 4 ? <li>+{rules.length - 4} regras</li> : null}
          </ul>
        </div>
      </div>
    </article>
  );
}
