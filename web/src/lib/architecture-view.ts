import type { CanvasNodeData, NodeKind } from "./types";
import { isArchData, isBlockData, isZoneData } from "./types";

/** Modos de vista do canvas (4 vistas do padrão de arquitetura). */
export type ArchitectureView = "ai" | "aa" | "ad" | "an";

export const ARCHITECTURE_VIEWS: { id: ArchitectureView; label: string; short: string }[] = [
  { id: "ai", label: "Runtime (AI)", short: "AI" },
  { id: "aa", label: "Aplicação (AA)", short: "AA" },
  { id: "ad", label: "Dados (AD)", short: "AD" },
  { id: "an", label: "Negócio (AN)", short: "AN" },
];

const AA_KINDS: NodeKind[] = ["backend", "frontend", "integration", "identity"];
const AD_KINDS: NodeKind[] = ["database"];
const AI_EMPHASIS_KINDS: NodeKind[] = ["cloud", "observability", "deploy"];

/**
 * Opacidade do nó conforme a vista ativa.
 * 1 = destaque, ~0.35 = esmaecido (ainda legível).
 */
export function nodeOpacityForView(data: CanvasNodeData, view: ArchitectureView): number {
  if (view === "ai") return 1;
  if (isZoneData(data)) {
    if (view === "aa") return 0.45;
    if (view === "ad") return 0.4;
    if (view === "an") return 0.35;
    return 1;
  }
  if (isBlockData(data)) {
    if (view === "aa") return AA_KINDS.includes(data.domain) ? 1 : 0.35;
    if (view === "ad") return data.domain === "database" ? 1 : 0.35;
    if (view === "an") return 0.5;
    return 1;
  }
  if (!isArchData(data)) return 1;
  if (view === "aa") return AA_KINDS.includes(data.kind) || data.kind === "cloud" ? 1 : 0.35;
  if (view === "ad") return AD_KINDS.includes(data.kind) ? 1 : 0.3;
  if (view === "an") return 0.55;
  return AI_EMPHASIS_KINDS.includes(data.kind) || true ? 1 : 1;
}
