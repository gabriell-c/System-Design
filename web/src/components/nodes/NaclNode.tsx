"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { ListTree } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { useGraphStore } from "@/lib/graph-store";
import type { ArchNodeData } from "@/lib/types";

export default function NaclNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const rules = data.naclRules ?? [];
  const blastUnreachable = useGraphStore((s) => s.blastUnreachableIds);
  const inBlast = blastUnreachable.includes(id);

  return (
    <article
      className={`min-w-[220px] max-w-[280px] rounded-xl border px-3 py-2.5 elev-2 ${
        selected ? "ring-2 ring-orange-400/80" : ""
      } ${inBlast ? "ring-2 ring-rose-500/70" : ""}`}
      style={{
        background: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, #121821 75%)",
        borderColor: "rgba(251, 146, 60, 0.55)",
      }}
      aria-label={`NACL ${data.label}, ${rules.length} regras`}
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "40%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "40%" }} />

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-orange-200">
          <ListTree size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-orange-50">{data.label}</p>
          <p className="text-sm uppercase tracking-wide text-orange-300/90">Network ACL (stateless)</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--muted-fg)]">
            {rules.length === 0 ? (
              <li>Sem regras — stateless deny-by-default</li>
            ) : (
              rules.slice(0, 4).map((r, i) => (
                <li key={i}>
                  #{r.rule_number} {r.action} {r.protocol}:{r.port_range ?? "*"}
                  {r.cidr ? ` ← ${r.cidr}` : ""}
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
