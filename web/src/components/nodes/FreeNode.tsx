"use client";

import { NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { useGraphStore } from "@/lib/graph-store";
import type { FreeNodeData, FreeNodeKind } from "@/lib/types";

const SHAPE_STYLES: Record<
  FreeNodeKind,
  { className: string; style?: CSSProperties }
> = {
  "free-rectangle": {
    className: "rounded-lg border-2 bg-[var(--surface-2)]",
  },
  "free-circle": {
    className: "rounded-full border-2 bg-[var(--surface-2)]",
  },
  "free-oval": {
    className: "rounded-full border-2 bg-[var(--surface-2)]",
    style: { aspectRatio: "16/9" },
  },
  "free-diamond": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { transform: "rotate(45deg)" },
  },
  "free-triangle": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" },
  },
  "free-hexagon": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" },
  },
  "free-octagon": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" },
  },
  "free-arrow-right": {
    className: "rounded-md border-2 bg-[var(--accent-muted)]",
    style: { clipPath: "polygon(0% 20%, 70% 20%, 70% 0%, 100% 50%, 70% 100%, 70% 80%, 0% 80%)" },
  },
  "free-arrow-double": {
    className: "rounded-md border-2 bg-[var(--accent-muted)]",
    style: { clipPath: "polygon(0% 20%, 70% 20%, 70% 0%, 100% 50%, 70% 100%, 70% 80%, 0% 80%)" },
  },
  "free-check": {
    className: "rounded-full border-2 bg-emerald-500/20 border-emerald-400",
    style: { color: "#34d399" },
  },
  "free-x": {
    className: "rounded-full border-2 bg-rose-500/20 border-rose-400",
    style: { color: "#f43f5e" },
  },
  "free-plus": {
    className: "rounded-full border-2 bg-indigo-500/20 border-indigo-400",
    style: { color: "#818cf8" },
  },
  "free-text": {
    className: "rounded-md border border-dashed border-[var(--border)] bg-transparent px-2 py-1",
  },
  "free-edit": {
    className: "rounded-md border border-dashed border-[var(--accent)]/50 bg-[var(--accent-muted)]/10 px-2 py-1",
  },
};

export default function FreeNode({ id, data, selected }: NodeProps<Node<FreeNodeData>>) {
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const shape = SHAPE_STYLES[data.kind];
  const isText = data.kind === "free-text" || data.kind === "free-edit";
  const isDiamond = data.kind === "free-diamond";
  const isTriangle = data.kind === "free-triangle";

  return (
    <div
      className={`relative h-full w-full ${selected ? "ring-2 ring-[var(--accent)]/70" : ""}`}
      aria-label={data.label}
    >
      <NodeResizer
        minWidth={80}
        minHeight={40}
        isVisible={selected}
        lineClassName="!border-[var(--accent)]/40"
        handleClassName="!h-2 !w-2 !rounded-sm !border-indigo-300 !bg-slate-950"
      />

      <div
        className={`flex h-full w-full items-center justify-center border-[var(--border)] px-3 py-2 text-center ${shape.className}`}
        style={shape.style}
      >
        {isText ? (
          <textarea
            className="h-full w-full resize-none bg-transparent text-sm text-[var(--foreground)] focus:outline-none"
            value={data.text ?? data.label}
            onChange={(e) =>
              updateNodeData(id, {
                text: e.target.value,
                label: e.target.value.slice(0, 60) || "Texto",
              })
            }
            placeholder="Digite aqui…"
          />
        ) : (
          <span
            className={`text-sm font-medium text-[var(--foreground)] ${
              isDiamond || isTriangle ? "[transform:rotate(-45deg)]" : ""
            }`}
          >
            {data.label}
          </span>
        )}
      </div>

      {!isText && (
        <>
          <AnchorHandle tone="block" nodeId={id} handleId="f-left" type="target" position={Position.Left} style={{ top: "50%" }} />
          <AnchorHandle tone="block" nodeId={id} handleId="f-right" type="source" position={Position.Right} style={{ top: "50%" }} />
          <AnchorHandle tone="block" nodeId={id} handleId="f-top" type="target" position={Position.Top} style={{ left: "50%" }} />
          <AnchorHandle tone="block" nodeId={id} handleId="f-bottom" type="source" position={Position.Bottom} style={{ left: "50%" }} />
        </>
      )}
    </div>
  );
}
