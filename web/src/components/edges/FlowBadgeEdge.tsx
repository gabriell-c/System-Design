"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import FlowBadge from "@/components/canvas/FlowBadge";
import { normalizeEdgeData } from "@/lib/edges";

/** Aresta com badge numerado para fluxos críticos (P0.2.2). */
export default function FlowBadgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const edgeData = normalizeEdgeData(data);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const caption = edgeData.label?.trim();
  const showBadge = edgeData.flowNumber != null;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {(showBadge || caption) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none flex items-center gap-1.5"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {showBadge && (
              <FlowBadge number={edgeData.flowNumber!} critical={edgeData.isCriticalPath} />
            )}
            {caption && (
              <span className="rounded-md border border-white/10 bg-[#0d1219]/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 shadow">
                {caption}
                {edgeData.isCriticalPath ? " ★" : ""}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
