"use client";

import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import ArchNode from "@/components/nodes/ArchNode";
import BlockNode from "@/components/nodes/BlockNode";
import ZoneNode from "@/components/nodes/ZoneNode";
import { api } from "@/lib/api";
import type { CanvasNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

const nodeTypes = { arch: ArchNode, block: BlockNode, zone: ZoneNode };

function EmbedInner({ graphId }: { graphId: string }) {
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    void api.getEmbed(graphId).then((payload) => {
      setName(payload.name);
      setNodes(payload.nodes as Node<CanvasNodeData>[]);
      setEdges(payload.edges as Edge[]);
    });
  }, [graphId]);

  return (
    <div className="h-screen w-screen bg-[#070b10]">
      <p className="absolute left-3 top-2 z-10 text-xs text-slate-500">{name} · embed</p>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false} nodesConnectable={false}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      </ReactFlow>
    </div>
  );
}

export default function EmbedPage() {
  const [graphId, setGraphId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGraphId(params.get("graph"));
  }, []);

  if (!graphId) {
    return <p className="p-8 text-slate-400">Missing ?graph= id</p>;
  }

  return (
    <ReactFlowProvider>
      <EmbedInner graphId={graphId} />
    </ReactFlowProvider>
  );
}
