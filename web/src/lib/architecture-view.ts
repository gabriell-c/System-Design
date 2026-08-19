import type { CanvasNodeData, NodeKind, C4Level } from "./types";
import { isArchData, isBlockData, isZoneData } from "./types";

/** Modos de vista do canvas (4+1 vistas: logical, physical, component, deployment, all). */
export type ArchitectureView = "all" | "logical" | "physical" | "component" | "deployment";

export const ARCHITECTURE_VIEWS: { id: ArchitectureView; label: string; short: string; icon: string }[] = [
  { id: "all", label: "Tudo", short: "All", icon: "⊞" },
  { id: "logical", label: "Lógico (C4 System)", short: "Sys", icon: "◇" },
  { id: "physical", label: "Físico (C4 Container)", short: "Cont", icon: "▣" },
  { id: "component", label: "Componente (C4 Component)", short: "Comp", icon: "◈" },
  { id: "deployment", label: "Deployment (C4 Code)", short: "Code", icon: "▪" },
];

/** Mapeamento de node kind para visão preferencial */
const LOGICAL_KINDS: NodeKind[] = ["frontend", "backend", "integration", "identity", "security", "cloud"];
const PHYSICAL_KINDS: NodeKind[] = ["database", "cloud"];
const COMPONENT_KINDS: NodeKind[] = ["backend", "frontend", "integration", "database", "identity"];
const DEPLOYMENT_KINDS: NodeKind[] = ["cloud", "deploy", "observability", "integration"];

/** C4 Level para cada vista */
export const VIEW_C4_LEVEL: Record<ArchitectureView, C4Level | null> = {
  all: null,
  logical: "system",
  physical: "container",
  component: "component",
  deployment: "code",
};

/**
 * Opacidade do nó conforme a vista ativa.
 * 1 = destaque, ~0.35 = esmaecido (ainda legível).
 */
export function nodeOpacityForView(data: CanvasNodeData, view: ArchitectureView): number {
  if (view === "all") return 1;
  if (isZoneData(data)) {
    return 0.6;
  }
  if (isBlockData(data)) {
    const domain = data.domain ?? data.kind;
    if (view === "logical") return LOGICAL_KINDS.includes(domain as NodeKind) ? 1 : 0.3;
    if (view === "physical") return PHYSICAL_KINDS.includes(domain as NodeKind) ? 1 : 0.3;
    if (view === "component") return COMPONENT_KINDS.includes(domain as NodeKind) ? 1 : 0.3;
    if (view === "deployment") return DEPLOYMENT_KINDS.includes(domain as NodeKind) ? 1 : 0.3;
    return 1;
  }
  if (!isArchData(data)) return 1;
  if (view === "logical") return LOGICAL_KINDS.includes(data.kind) ? 1 : 0.3;
  if (view === "physical") return PHYSICAL_KINDS.includes(data.kind) ? 1 : 0.3;
  if (view === "component") return COMPONENT_KINDS.includes(data.kind) ? 1 : 0.3;
  if (view === "deployment") return DEPLOYMENT_KINDS.includes(data.kind) ? 1 : 0.3;
  return 1;
}

/** Obtém o nível C4 recomendado para a vista atual */
export function getC4LevelForView(view: ArchitectureView): C4Level | null {
  return VIEW_C4_LEVEL[view];
}

/** Lista de nós que deveriam estar na vista (para drill-down) */
export function nodesForView(nodes: CanvasNodeData[], view: ArchitectureView): CanvasNodeData[] {
  if (view === "all") return nodes;
  return nodes.filter((n) => nodeOpacityForView(n, view) >= 0.5);
}
