"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import type { TenantBoundaryData } from "@/lib/types";

/** P0.3.7 — Boundary multi-tenant (pool / silo / bridge). */
export default function TenantBoundaryNode({ id, data, selected }: NodeProps<Node<TenantBoundaryData>>) {
  const mode = data.tenantMode ?? "silo";

  return (
    <article
      className={`min-w-[240px] rounded-xl border-2 border-dashed px-3 py-2.5 ${
        selected ? "ring-2 ring-fuchsia-400/70" : ""
      }`}
      style={{ background: "rgba(217,70,239,0.06)", borderColor: "rgba(232,121,249,0.45)" }}
      aria-label={`Tenant boundary ${mode}`}
    >
      <AnchorHandle nodeId={id} handleId="left" type="target" position={Position.Left} style={{ top: "50%" }} />
      <AnchorHandle nodeId={id} handleId="right" type="source" position={Position.Right} style={{ top: "50%" }} />
      <div className="flex items-start gap-2">
        <Users size={16} className="mt-0.5 text-fuchsia-300" />
        <div>
          <p className="text-sm font-semibold text-fuchsia-100">{data.label}</p>
          <p className="text-sm uppercase tracking-wide text-fuchsia-300/80">Multi-tenant · {mode}</p>
          {data.tenantIds?.length ? (
            <p className="mt-1 text-sm text-[var(--muted-fg)]">{data.tenantIds.slice(0, 4).join(", ")}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
