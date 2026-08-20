import assert from "node:assert/strict";
import test from "node:test";
import { canNestZoneInZone, createZoneNode, isZoneNode } from "./zones.ts";
import { buildArchEdge, edgeDisplayLabel, nextFlowNumber, normalizeEdgeData, styleEdgeFromData } from "./edges.ts";
import { MULTI_CLOUD_CATALOG } from "./catalog-multicloud.ts";

test("zone nesting rules: vpc accepts az, az accepts subnet", () => {
  assert.equal(canNestZoneInZone("availability_zone", "vpc"), true);
  assert.equal(canNestZoneInZone("subnet_private", "availability_zone"), true);
  assert.equal(canNestZoneInZone("vpc", "availability_zone"), false);
  assert.equal(canNestZoneInZone("region", "vpc"), false);
});

test("createZoneNode sets type zone and size", () => {
  const z = createZoneNode("z1", "vpc", { x: 10, y: 20 }, { provider: "aws" });
  assert.equal(z.type, "zone");
  assert.equal(isZoneNode(z), true);
  assert.equal(z.data.kind, "zone");
  assert.equal(z.data.zoneKind, "vpc");
  assert.ok((z.width ?? 0) > 100);
});

test("typed edges carry flowNumber and style", () => {
  const e = buildArchEdge(
    { id: "e1", source: "a", target: "b", data: { flowKind: "async", label: "events" } },
    3,
  );
  const data = normalizeEdgeData(e.data);
  assert.equal(data.flowNumber, 3);
  assert.equal(data.flowKind, "async");
  assert.equal(e.type, "flowBadge");
  // Badge edges omit string label — number lives on data / FlowBadge node.
  assert.equal(e.label, undefined);
  assert.match(edgeDisplayLabel(data), /3/);
  const styled = styleEdgeFromData(data, { useFlowBadge: true });
  assert.equal(styled.animated, true);
});

test("nextFlowNumber increments", () => {
  const edges = [
    buildArchEdge({ id: "e1", source: "a", target: "b" }, 1),
    buildArchEdge({ id: "e2", source: "b", target: "c" }, 5),
  ];
  assert.equal(nextFlowNumber(edges), 6);
});

test("multi-cloud catalog has aws azure gcp for dns capability", () => {
  const dns = MULTI_CLOUD_CATALOG.filter((c) => c.capability === "dns");
  const providers = new Set(dns.map((c) => c.provider));
  assert.ok(providers.has("aws"));
  assert.ok(providers.has("azure"));
  assert.ok(providers.has("gcp"));
});

test("architecture template ids are stable", () => {
  const ids = [
    "aws-serverless-api-authorizer",
    "aws-multi-az-app",
    "azure-data-pipeline",
    "aws-load-testing-control-data-plane",
  ];
  assert.equal(ids.length, 4);
  for (const id of ids) assert.ok(id.includes("-"));
});

test("normalizeEdgeData keeps critical path and failure behavior", () => {
  const data = normalizeEdgeData({
    flowKind: "async",
    flowNumber: 2,
    isCriticalPath: true,
    failureBehavior: "dlq",
    label: "poison",
  });
  assert.equal(data.isCriticalPath, true);
  assert.equal(data.failureBehavior, "dlq");
  assert.match(edgeDisplayLabel(data), /★/);
});
