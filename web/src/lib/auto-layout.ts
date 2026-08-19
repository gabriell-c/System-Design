/** P0.2.2 — Auto-layout por zonas (Edge → Public → Private → Data). */

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, ZoneKind } from "./types";
import { isZoneData } from "./types";
import { isSwimlaneNode } from "./swimlanes";
import { isZoneNode, zoneKindOf, ZONE_DEFAULT_SIZE } from "./zones";
import { swimlaneSize } from "./swimlanes";

const LANE_ORDER: ZoneKind[] = [
  "region",
  "vpc",
  "availability_zone",
  "subnet_public",
  "subnet_private",
  "layer",
  "plane",
  "security_boundary",
  "tgw",
  "nat_gateway",
];

const CARD_W = 220;
const CARD_H = 88;
const GAP = 24;
const PAD = 32;

function containerSize(node: Node<CanvasNodeData>): { width: number; height: number } {
  if (isZoneNode(node)) {
    const kind = zoneKindOf(node);
    return kind ? ZONE_DEFAULT_SIZE[kind] : { width: 520, height: 320 };
  }
  if (isSwimlaneNode(node)) return swimlaneSize(node);
  return {
    width: Number(node.width ?? (node.style as { width?: number })?.width ?? 420),
    height: Number(node.height ?? (node.style as { height?: number })?.height ?? 280),
  };
}

/** Organiza cards filhos dentro de cada contêiner, zonas em colunas por tipo. */
export function autoLayoutByZones(
  nodes: Node<CanvasNodeData>[],
  _edges: Edge[],
): Node<CanvasNodeData>[] {
  const next = nodes.map((n) => ({ ...n, position: { ...n.position } }));
  const byId = new Map(next.map((n) => [n.id, n]));

  const zones = next.filter((n) => isZoneNode(n) || isSwimlaneNode(n));
  zones.sort((a, b) => {
    const za = isZoneNode(a) ? LANE_ORDER.indexOf(zoneKindOf(a) ?? "layer") : 99;
    const zb = isZoneNode(b) ? LANE_ORDER.indexOf(zoneKindOf(b) ?? "layer") : 99;
    return za - zb;
  });

  let colX = 40;
  for (const zone of zones) {
    if (!zone.parentId) {
      zone.position = { x: colX, y: 40 };
      colX += containerSize(zone).width + GAP;
    }
    const children = next.filter((n) => n.parentId === zone.id && !isZoneNode(n) && !isSwimlaneNode(n));
    let cx = PAD;
    let cy = PAD + 24;
    let rowH = 0;
    for (const child of children) {
      child.position = { x: cx, y: cy };
      cx += CARD_W + GAP;
      rowH = Math.max(rowH, CARD_H);
      const maxW = containerSize(zone).width - PAD * 2;
      if (cx + CARD_W > maxW) {
        cx = PAD;
        cy += rowH + GAP;
        rowH = 0;
      }
    }
    byId.set(zone.id, zone);
  }

  const orphans = next.filter((n) => !n.parentId && !isZoneNode(n) && !isSwimlaneNode(n));
  let ox = 40;
  for (const o of orphans) {
    o.position = { x: ox, y: 600 };
    ox += CARD_W + GAP;
  }

  return next;
}
