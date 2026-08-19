import type { Node } from "@xyflow/react";
import { PATTERNS_CATALOG } from "./catalog-patterns";
import { findCatalog } from "./catalog";
import type { CanvasNodeData, NodeKind } from "./types";
import { createZoneNode, ZONE_DEFAULT_SIZE } from "./zones";

export type PatternApplyParams = {
  orchestratorLabel?: string;
  participantCount?: number;
  queueName?: string;
};

/** P1.3.2 — Apply architecture pattern as canvas nodes. */
export function applyPattern(
  patternId: string,
  position: { x: number; y: number },
  params?: PatternApplyParams,
): Node<CanvasNodeData>[] {
  const pattern = PATTERNS_CATALOG.find((p) => p.id === patternId);
  if (!pattern) return [];

  const nodes: Node<CanvasNodeData>[] = [];
  const baseId = `pat-${Date.now()}`;

  if (patternId === "pat-saga") {
    const orchId = `${baseId}-orch`;
    nodes.push({
      id: orchId,
      type: "saga",
      position,
      data: {
        kind: "integration",
        label: params?.orchestratorLabel ?? "Saga Orchestrator",
        catalogId: patternId,
        tech: "Saga",
        config: { service: "Saga Orchestrator" },
        score: null,
      },
    });
    const count = params?.participantCount ?? 3;
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `${baseId}-step-${i}`,
        type: "arch",
        position: { x: position.x + 220 * (i + 1), y: position.y + 80 },
        data: {
          kind: "backend",
          label: `Saga Step ${i + 1}`,
          catalogId: "pat-microservices",
          tech: "Service",
          config: { service: `Step ${i + 1}` },
          score: null,
        },
      });
    }
    return nodes;
  }

  if (patternId === "pat-outbox") {
    nodes.push({
      id: `${baseId}-outbox`,
      type: "arch",
      position,
      data: {
        kind: "database",
        label: "Outbox Table",
        catalogId: patternId,
        tech: "Outbox",
        config: { service: "Transactional Outbox" },
        score: null,
      },
    });
    nodes.push({
      id: `${baseId}-relay`,
      type: "arch",
      position: { x: position.x + 240, y: position.y },
      data: {
        kind: "integration",
        label: params?.queueName ?? "Event Relay",
        catalogId: "pat-event-driven",
        tech: "Relay",
        config: { service: "Outbox Relay" },
        score: null,
      },
    });
    return nodes;
  }

  const item = findCatalog(patternId) ?? pattern;
  nodes.push({
    id: baseId,
    type: "arch",
    position,
    data: {
      kind: item.kind as NodeKind,
      label: item.label,
      catalogId: patternId,
      tech: item.tech,
      config: { ...item.defaults },
      score: null,
    },
  });
  return nodes;
}

export function applyPatternBundle(
  patternIds: string[],
  origin: { x: number; y: number },
): Node<CanvasNodeData>[] {
  let offset = 0;
  const all: Node<CanvasNodeData>[] = [];
  for (const id of patternIds) {
    all.push(...applyPattern(id, { x: origin.x, y: origin.y + offset }));
    offset += 120;
  }
  return all;
}

export function patternFromZone(zoneKind: string, position: { x: number; y: number }): Node<CanvasNodeData> | null {
  if (zoneKind !== "data_mesh") return null;
  return createZoneNode(`zone-${Date.now()}`, "data_mesh", position, {
    label: "Data Product Zone",
    boundedContext: "Bounded Context",
  }) as Node<CanvasNodeData>;
}

export { ZONE_DEFAULT_SIZE };
