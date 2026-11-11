import type { Node } from "@xyflow/react";
import { PATTERNS_CATALOG } from "./catalog-patterns";
import { nextId } from "./stores/helpers";
import type { CanvasNodeData, NodeKind } from "./types";
import { createZoneNode, ZONE_DEFAULT_SIZE } from "./zones";

export type PatternApplyParams = {
  orchestratorLabel?: string;
  participantCount?: number;
  queueName?: string;
};

// Passos do layout dos padrões (mesma grade do snap do canvas)
const SAGA_STEP_X = 220;
const SAGA_STEP_Y = 80;
const OUTBOX_RELAY_X = 240;
const BUNDLE_ROW_Y = 120;

/** P1.3.2 — Apply architecture pattern as canvas nodes. */
export function applyPattern(
  patternId: string,
  position: { x: number; y: number },
  params?: PatternApplyParams,
): Node<CanvasNodeData>[] {
  const pattern = PATTERNS_CATALOG.find((p) => p.id === patternId);
  if (!pattern) return [];

  const nodes: Node<CanvasNodeData>[] = [];
  const baseId = nextId("pat");

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
        position: { x: position.x + SAGA_STEP_X * (i + 1), y: position.y + SAGA_STEP_Y },
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
      position: { x: position.x + OUTBOX_RELAY_X, y: position.y },
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

  nodes.push({
    id: baseId,
    type: "arch",
    position,
    data: {
      kind: pattern.kind as NodeKind,
      label: pattern.label,
      catalogId: patternId,
      tech: pattern.tech,
      config: { ...pattern.defaults },
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
    offset += BUNDLE_ROW_Y;
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
