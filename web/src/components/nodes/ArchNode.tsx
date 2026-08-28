"use client";

import { Position, type Node, type NodeProps } from "@xyflow/react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { KIND_META } from "@/lib/catalog";
import { useGraphStore } from "@/lib/graph-store";
import { nodeOpacityForView } from "@/lib/architecture-view";
import { TechIcon } from "@/lib/tech-icons";
import { getOfficialIcon, useOfficialIconMode } from "@/lib/catalog-icons";
import type { ArchNodeData } from "@/lib/types";
import NodeGlossaryTooltip from "@/components/canvas/NodeGlossaryTooltip";
import LinkButton from "@/components/nodes/LinkButton";

function scoreTone(score?: number | null): string {
  if (score == null) return "bg-slate-700 text-slate-300";
  if (score >= 8) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 6) return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-rose-500/20 text-rose-200 border-rose-500/40";
}

export default function ArchNode({ id, data, selected }: NodeProps<Node<ArchNodeData>>) {
  const architectureView = useGraphStore((s) => s.architectureView);
  const highlightNodeIds = useGraphStore((s) => s.highlightNodeIds);
  const blastUnreachable = useGraphStore((s) => s.blastUnreachableIds);
  const blastDegraded = useGraphStore((s) => s.blastDegradedIds);
  const diffHighlights = useGraphStore((s) => s.diffHighlights);
  const officialIcon = useOfficialIconMode() ? getOfficialIcon(data.catalogId) : null;
  const highlighted = highlightNodeIds.includes(id);
  const blastDown = blastUnreachable.includes(id);
  const blastDegradedNode = blastDegraded.includes(id);
  const diffStatus = diffHighlights.find((h) => h.nodeId === id)?.status;
  const diffColor = diffStatus === "added" ? "#22c55e" : diffStatus === "removed" ? "#ef4444" : diffStatus === "changed" ? "#eab308" : null;
  const isLocked = useGraphStore((s) => s.isLocked);
  const opacity = nodeOpacityForView(data, architectureView);
  const meta = KIND_META[data.kind];
  const subtitle =
    data.config.framework ||
    data.config.engine ||
    [data.config.provider, data.config.service].filter(Boolean).join(" · ") ||
    data.tech;

  return (
    <NodeGlossaryTooltip nodeId={data.catalogId ?? id} nodeLabel={data.label} nodeTech={data.tech}>
      <article
        className={`relative min-w-[210px] max-w-[240px] rounded-xl border px-3 py-2.5 elev-2 shadow-black/40 ${
          selected || highlighted ? "ring-2 ring-cyan-400/70" : ""
        } ${
          blastDown
            ? "animate-pulse border-rose-500 ring-2 ring-rose-500/60 shadow-rose-500/40"
            : blastDegradedNode
              ? "border-amber-500 ring-2 ring-amber-500/40"
              : data.bottleneck
            ? "animate-pulse border-rose-500 ring-2 ring-rose-500/50 shadow-rose-500/30"
            : highlighted
              ? "border-[var(--accent)] shadow-cyan-500/20"
              : ""
        } ${diffStatus === "added" ? "border-emerald-500 ring-2 ring-emerald-500/50" : diffStatus === "removed" ? "border-rose-500 ring-2 ring-rose-500/50" : diffStatus === "changed" ? "border-amber-500 ring-2 ring-amber-500/50" : ""}`}
        style={{
          background: blastDown
            ? "rgba(127, 29, 29, 0.45)"
            : blastDegradedNode
              ? "rgba(120, 53, 15, 0.35)"
              : data.bottleneck
                ? "rgba(127, 29, 29, 0.35)"
                : diffStatus === "removed"
                  ? "rgba(127, 29, 29, 0.2)"
                  : "#121821",
          borderColor: blastDown
            ? "rgb(244, 63, 94)"
            : blastDegradedNode
              ? "rgb(245, 158, 11)"
              : data.bottleneck
                ? "rgb(244, 63, 94)"
                : (diffColor ?? meta.border),
          opacity: diffStatus === "removed" ? 0.4 : opacity,
        }}
        title={data.bottleneck ? data.summary || "Gargalo detectado na análise" : undefined}
        role="article"
        aria-label={`${data.label} - ${meta.label}${data.c4Level ? ` (C4: ${data.c4Level})` : ""}${data.piiSensitivity && data.piiSensitivity !== "none" ? ` - PII: ${data.piiSensitivity}` : ""}`}
        tabIndex={0}
      >
      {isLocked ? null : (
        <>
          <AnchorHandle nodeId={id} handleId="left-in" type="target" position={Position.Left} style={{ top: "40%" }} />
          <AnchorHandle nodeId={id} handleId="left-out" type="source" position={Position.Left} style={{ top: "65%" }} />
          <AnchorHandle nodeId={id} handleId="right-out" type="source" position={Position.Right} style={{ top: "40%" }} />
          <AnchorHandle nodeId={id} handleId="right-in" type="target" position={Position.Right} style={{ top: "65%" }} />
          <AnchorHandle nodeId={id} handleId="top-in" type="target" position={Position.Top} style={{ left: "40%" }} />
          <AnchorHandle nodeId={id} handleId="top-out" type="source" position={Position.Top} style={{ left: "65%" }} />
          <AnchorHandle nodeId={id} handleId="bottom-out" type="source" position={Position.Bottom} style={{ left: "40%" }} />
          <AnchorHandle nodeId={id} handleId="bottom-in" type="target" position={Position.Bottom} style={{ left: "65%" }} />
        </>
      )}

        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold uppercase"
            style={{
              background: officialIcon ? `${officialIcon.color}22` : meta.bg,
              color: officialIcon?.color ?? meta.accent,
              border: officialIcon ? `1px solid ${officialIcon.color}55` : undefined,
            }}
            aria-hidden
            title={officialIcon ? `${officialIcon.provider} · ${officialIcon.service}` : undefined}
          >
            {officialIcon ? officialIcon.service.slice(0, 3) : <TechIcon catalogId={data.catalogId} kind={data.kind} size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-100">{data.label}</p>
              {data.bottleneck ? (
                <span
                  className="rounded-md border border-rose-400/50 bg-rose-500/25 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-rose-100"
                  title={data.summary || "Gargalo"}
                >
                  Gargalo
                </span>
              ) : data.score != null ? (
                <span
                  className={`rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums ${scoreTone(data.score)}`}
                  title="Nota heurística do node"
                >
                  {data.score.toFixed(1)}
                </span>
              ) : null}
            </div>
            <p className="text-sm uppercase tracking-wide" style={{ color: data.bottleneck ? "#fda4af" : meta.accent }}>
              {meta.label}
              {data.kind === "database" && data.piiSensitivity && data.piiSensitivity !== "none" && (
                <span className="ml-1 rounded bg-rose-500/20 px-1 text-sm text-rose-200">
                  PII {data.piiSensitivity}
                </span>
              )}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--muted-fg)]">
              {data.bottleneck && data.summary ? data.summary : subtitle}
            </p>
          </div>
        </div>
        {data.linkUrl && <LinkButton href={data.linkUrl} />}
      </article>
    </NodeGlossaryTooltip>
  );
}
