import type { Node } from "@xyflow/react";
import type { CanvasNodeData, SwimlaneKind, SwimlaneNodeData } from "./types";
import { ALL_SWIMLANE_KINDS } from "./types";

export { ALL_SWIMLANE_KINDS };

export const SWIMLANE_DEFAULT_SIZE: Record<SwimlaneKind, { width: number; height: number }> = {
  frontend: { width: 960, height: 200 },
  backend: { width: 960, height: 220 },
  database: { width: 960, height: 180 },
  dev_flow: { width: 960, height: 240 },
  user_flow: { width: 960, height: 240 },
};

export const SWIMLANE_META: Record<
  SwimlaneKind,
  { label: string; accent: string; bg: string; border: string; short: string }
> = {
  frontend: {
    label: "Frontend / Cliente",
    short: "Frontend",
    accent: "#818cf8",
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(129, 140, 248, 0.45)",
  },
  backend: {
    label: "Backend / Serviços",
    short: "Backend",
    accent: "#38bdf8",
    bg: "rgba(14, 165, 233, 0.08)",
    border: "rgba(56, 189, 248, 0.45)",
  },
  database: {
    label: "Database / Persistência",
    short: "Database",
    accent: "#34d399",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(52, 211, 153, 0.45)",
  },
  dev_flow: {
    label: "Fluxo Dev (CI/CD)",
    short: "Dev",
    accent: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(251, 191, 36, 0.45)",
  },
  user_flow: {
    label: "Fluxo User (Runtime)",
    short: "User",
    accent: "#f472b6",
    bg: "rgba(244, 114, 182, 0.08)",
    border: "rgba(244, 114, 182, 0.45)",
  },
};

export function isSwimlaneNode(node: Node<CanvasNodeData>): boolean {
  return node.type === "swimlane" || node.data.kind === "swimlane";
}

export function swimlaneKindOf(node: Node<CanvasNodeData>): SwimlaneKind | null {
  if (!isSwimlaneNode(node) || node.data.kind !== "swimlane") return null;
  return node.data.swimlaneKind;
}

export function createSwimlaneNode(
  id: string,
  swimlaneKind: SwimlaneKind,
  position: { x: number; y: number },
  opts?: { label?: string },
): Node<SwimlaneNodeData> {
  const size = SWIMLANE_DEFAULT_SIZE[swimlaneKind];
  const meta = SWIMLANE_META[swimlaneKind];
  return {
    id,
    type: "swimlane",
    position,
    width: size.width,
    height: size.height,
    style: { ...size, zIndex: -2 },
    data: {
      kind: "swimlane",
      swimlaneKind,
      label: opts?.label ?? meta.label,
    },
  };
}

export function swimlaneSize(node: Node<CanvasNodeData>): { width: number; height: number } {
  const kind = swimlaneKindOf(node);
  const fallback = kind ? SWIMLANE_DEFAULT_SIZE[kind] : { width: 960, height: 200 };
  const width = Number(node.width ?? (node.style as { width?: number } | undefined)?.width ?? fallback.width);
  const height = Number(node.height ?? (node.style as { height?: number } | undefined)?.height ?? fallback.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : fallback.width,
    height: Number.isFinite(height) && height > 0 ? height : fallback.height,
  };
}
