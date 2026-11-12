"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { useGraphStore } from "@/lib/graph-store";
import type { ArchNodeData } from "@/lib/types";

export default function CircuitBreakerNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const blastUnreachableIds = useGraphStore((s) => s.blastUnreachableIds);
  // S3b (item 68b): Set memoizado — membership O(1) em todo change.
  const blastUnreachable = useMemo(() => new Set(blastUnreachableIds), [blastUnreachableIds]);
  const inBlast = blastUnreachable.has(id);
  const cb = data.circuitBreaker;
  const state = cb?.state ?? "closed";

  return (
    <article
      className={`min-w-[200px] max-w-[240px] rounded-xl border px-3 py-2.5 elev-2 ${
        selected ? "ring-2 ring-amber-400/80" : ""
      } ${inBlast ? "ring-2 ring-rose-500/70" : ""}`}
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, #121821 70%)",
        // S3b (item 68a): token de tema em vez de #f43f5e cravado.
        borderColor: state === "open" ? "var(--error)" : "#f59e0b",
      }}
      aria-label={`Circuit breaker ${data.label}, estado ${state}`}
      tabIndex={0}
    >
      <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "50%" }} />
      <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "50%" }} />

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/25 text-amber-200">
          <ShieldAlert size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-amber-50">{data.label}</p>
          <p className="text-sm uppercase tracking-wide text-amber-300/90">Circuit breaker</p>
          <p className="mt-1 text-xs text-[var(--muted-fg)]">
            {cb?.failure_threshold ?? 5} falhas / {cb?.window_seconds ?? 60}s · {state}
          </p>
        </div>
      </div>
    </article>
  );
}
