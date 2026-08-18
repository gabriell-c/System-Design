import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, ProjectNfr } from "./types";

export type ProjectTemplate = {
  id: string;
  label: string;
  description: string;
  name: string;
  context: string;
  nfr: ProjectNfr;
  build: () => { nodes: Node<CanvasNodeData>[]; edges: Edge[] };
};
