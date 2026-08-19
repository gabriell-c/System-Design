import type { Edge } from "@xyflow/react";
import type { ArchEdgeData, FailureBehavior, FlowKind, FlowProtocol } from "./types";

export const DEFAULT_EDGE_DATA: ArchEdgeData = {
  flowKind: "sync",
  protocol: "https",
};

export const FLOW_KIND_META: Record<
  FlowKind,
  { label: string; stroke: string; dash?: string; animated: boolean }
> = {
  sync: { label: "Sync", stroke: "#94a3b8", animated: false },
  async: { label: "Async", stroke: "#a78bfa", dash: "6 4", animated: true },
  data: { label: "Data", stroke: "#34d399", animated: false },
  control: { label: "Control", stroke: "#38bdf8", dash: "4 2", animated: true },
  management: { label: "Mgmt", stroke: "#fbbf24", dash: "2 3", animated: false },
};

const FAILURE_BEHAVIORS: FailureBehavior[] = ["retry", "fallback", "dlq", "fail_fast", "none"];

export function normalizeEdgeData(raw: unknown): ArchEdgeData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EDGE_DATA };
  const o = raw as Partial<ArchEdgeData>;
  const flowKind = (["sync", "async", "data", "control", "management"] as FlowKind[]).includes(
    o.flowKind as FlowKind,
  )
    ? (o.flowKind as FlowKind)
    : "sync";
  const failureBehavior = FAILURE_BEHAVIORS.includes(o.failureBehavior as FailureBehavior)
    ? (o.failureBehavior as FailureBehavior)
    : undefined;
  return {
    flowKind,
    protocol: (o.protocol as FlowProtocol | undefined) ?? "https",
    flowNumber: typeof o.flowNumber === "number" ? o.flowNumber : undefined,
    label: typeof o.label === "string" ? o.label : undefined,
    isCriticalPath: o.isCriticalPath === true,
    failureBehavior,
    firewallRules: Array.isArray(o.firewallRules) ? o.firewallRules : undefined,
    circuitBreaker:
      o.circuitBreaker && typeof o.circuitBreaker === "object"
        ? (o.circuitBreaker as ArchEdgeData["circuitBreaker"])
        : undefined,
  };
}

export function edgeDisplayLabel(data: ArchEdgeData): string {
  const parts: string[] = [];
  if (data.flowNumber != null) parts.push(String(data.flowNumber));
  if (data.label?.trim()) parts.push(data.label.trim());
  else if (data.protocol && data.protocol !== "other") parts.push(data.protocol.toUpperCase());
  else parts.push(FLOW_KIND_META[data.flowKind].label);
  if (data.isCriticalPath) parts.push("★");
  return parts.join(" · ");
}

export function styleEdgeFromData(
  data: ArchEdgeData,
  opts?: { useFlowBadge?: boolean },
): Pick<
  Edge,
  "style" | "animated" | "label" | "labelStyle" | "labelBgStyle" | "labelBgPadding" | "labelBgBorderRadius"
> {
  const meta = FLOW_KIND_META[data.flowKind];
  const useBadge = opts?.useFlowBadge ?? data.flowNumber != null;
  return {
    animated: meta.animated || Boolean(data.isCriticalPath),
    label: useBadge ? undefined : edgeDisplayLabel(data),
    labelStyle: { fill: "#e2e8f0", fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "#0d1219", fillOpacity: 0.9 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
    style: {
      stroke: data.isCriticalPath ? "#f472b6" : meta.stroke,
      strokeWidth: data.isCriticalPath ? 2.5 : 2,
      strokeDasharray: meta.dash,
    },
  };
}

export function buildArchEdge(
  partial: Omit<Edge, "data" | "type"> & { data?: Partial<ArchEdgeData> },
  nextFlowNumber?: number,
): Edge {
  const data = normalizeEdgeData({
    ...DEFAULT_EDGE_DATA,
    flowNumber: nextFlowNumber,
    ...partial.data,
  });
  const useBadge = data.flowNumber != null;
  return {
    ...partial,
    type: useBadge ? "flowBadge" : "smoothstep",
    data,
    ...styleEdgeFromData(data, { useFlowBadge: useBadge }),
  };
}

/** Renumera fluxos críticos em ordem topológica simples (source→target). */
export function renumberCriticalFlows(edges: Edge[]): Edge[] {
  const sorted = [...edges].sort((a, b) => {
    const na = normalizeEdgeData(a.data).flowNumber ?? 9999;
    const nb = normalizeEdgeData(b.data).flowNumber ?? 9999;
    return na - nb;
  });
  let n = 1;
  return sorted.map((e) => {
    const data = normalizeEdgeData(e.data);
    if (!data.isCriticalPath && data.flowNumber == null) return e;
    const next = normalizeEdgeData({ ...data, flowNumber: n });
    n += 1;
    return {
      ...e,
      type: "flowBadge" as const,
      data: next,
      ...styleEdgeFromData(next, { useFlowBadge: true }),
    };
  });
}

export function nextFlowNumber(edges: Edge[]): number {
  let max = 0;
  for (const e of edges) {
    const d = normalizeEdgeData(e.data);
    if (typeof d.flowNumber === "number" && d.flowNumber > max) max = d.flowNumber;
  }
  return max + 1;
}
