"use client";

import { Handle, type HandleProps } from "@xyflow/react";
import { useGraphStore } from "@/lib/graph-store";

type Props = Omit<HandleProps, "onDoubleClick"> & {
  nodeId: string;
  handleId: string;
  tone?: "card" | "block";
};

/**
 * Ponto de ancoragem com double-click para desassociar arestas ligadas a este handle.
 */
export default function AnchorHandle({
  nodeId,
  handleId,
  tone = "card",
  className,
  ...rest
}: Props) {
  const disconnectHandle = useGraphStore((s) => s.disconnectHandle);
  const edges = useGraphStore((s) => s.edges);
  const connected = edges.some(
    (e) =>
      (e.source === nodeId && (e.sourceHandle ?? null) === handleId) ||
      (e.target === nodeId && (e.targetHandle ?? null) === handleId),
  );

  const base =
    tone === "block"
      ? "!h-3 !w-3 !rounded-full !border-2 !border-slate-950 !bg-indigo-300 hover:!scale-125 transition-transform"
      : "!h-2.5 !w-2.5 !rounded-full !border-2 !border-slate-950 !bg-slate-200 hover:!bg-indigo-300 hover:!scale-125 transition-transform";

  return (
    <Handle
      {...rest}
      id={handleId}
      className={`${base} ${connected ? "!bg-indigo-400 ring-2 ring-indigo-300/50" : ""} ${className ?? ""}`}
      title={
        connected
          ? "Duplo clique: desassociar conexões deste ponto"
          : "Arraste para conectar · duplo clique remove associações"
      }
      onDoubleClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        disconnectHandle(nodeId, handleId);
      }}
    />
  );
}
