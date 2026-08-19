import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_CANVAS_FILTER,
  descendantIds,
  isFilterActive,
  nodeMatchesFilter,
} from "./canvas-filter.ts";
import { canNestZoneInZone } from "./zones.ts";
import type { ArchNodeData, ZoneNodeData } from "./types.ts";

test("peering and vpn nest under region/vpc", () => {
  assert.equal(canNestZoneInZone("peering", "region"), true);
  assert.equal(canNestZoneInZone("vpn", "vpc"), true);
  assert.equal(canNestZoneInZone("privatelink", "subnet_private"), true);
  assert.equal(canNestZoneInZone("express_route", "vpc"), false);
});

test("filter matches catalog and layer views", () => {
  const db: ArchNodeData = {
    kind: "database",
    label: "Postgres",
    catalogId: "db-postgres",
    tech: "PostgreSQL",
    config: { provider: "aws" },
  };
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, query: "post" }), true);
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, kind: "frontend" }), false);
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, layerView: "storage" }), true);
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, layerView: "auth" }), false);
  assert.equal(isFilterActive(EMPTY_CANVAS_FILTER), false);
});

test("filter matches PII and C4 level", () => {
  const db: ArchNodeData = {
    kind: "database",
    label: "Postgres PII",
    catalogId: "db-postgres",
    tech: "PostgreSQL",
    config: { provider: "aws" },
    piiSensitivity: "high",
    c4Level: "container",
  };
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, piiSensitivity: "high" }), true);
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, piiSensitivity: "low" }), false);
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, c4Level: "container" }), true);
  assert.equal(nodeMatchesFilter(db, { ...EMPTY_CANVAS_FILTER, c4Level: "system" }), false);
  assert.equal(isFilterActive({ ...EMPTY_CANVAS_FILTER, piiSensitivity: "high" }), true);
  assert.equal(isFilterActive({ ...EMPTY_CANVAS_FILTER, c4Level: "component" }), true);
});

test("zone filter only matches zones", () => {
  const zone: ZoneNodeData = {
    kind: "zone",
    zoneKind: "vpn",
    label: "Hybrid VPN",
    provider: "aws",
  };
  assert.equal(nodeMatchesFilter(zone, { ...EMPTY_CANVAS_FILTER, zoneKind: "vpn" }), true);
  assert.equal(nodeMatchesFilter(zone, { ...EMPTY_CANVAS_FILTER, layerView: "network" }), true);
});

test("descendantIds walks nested parents", () => {
  const nodes = [
    { id: "r", data: { kind: "zone", zoneKind: "region", label: "R" } as ZoneNodeData, position: { x: 0, y: 0 } },
    { id: "v", parentId: "r", data: { kind: "zone", zoneKind: "vpc", label: "V" } as ZoneNodeData, position: { x: 0, y: 0 } },
    { id: "c", parentId: "v", data: { kind: "backend", label: "API", catalogId: "be-nest", tech: "Nest", config: {} } as ArchNodeData, position: { x: 0, y: 0 } },
  ];
  const ids = descendantIds(nodes, "r");
  assert.equal(ids.has("r"), true);
  assert.equal(ids.has("v"), true);
  assert.equal(ids.has("c"), true);
});
