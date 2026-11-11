import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";

function zoneNode(id: string, kind: string): Node<CanvasNodeData> {
  return {
    id,
    type: "zone",
    position: { x: 9999, y: 9999 },
    data: { kind: "zone", zoneKind: kind, label: id },
  } as unknown as Node<CanvasNodeData>;
}

function archNode(id: string, parentId?: string): Node<CanvasNodeData> {
  const n: Record<string, unknown> = {
    id,
    type: "arch",
    position: { x: 0, y: 0 },
    data: { kind: "arch", label: id, catalogId: "x", tech: "y", config: {} },
  };
  if (parentId) n.parentId = parentId;
  return n as unknown as Node<CanvasNodeData>;
}

function positions(nodes: Node<CanvasNodeData>[]): Record<string, { x: number; y: number }> {
  return Object.fromEntries(nodes.map((n) => [n.id, n.position]));
}

const input = [zoneNode("vpc", "vpc"), zoneNode("layer", "layer"), archNode("c1", "vpc"), archNode("o1")];
const noEdges: Edge[] = [];

test("autoLayoutByZones: deterministico — mesmo input => mesmas posicoes", async () => {
  const { autoLayoutByZones } = await import("./auto-layout");
  const a = positions(autoLayoutByZones(input, noEdges));
  const b = positions(autoLayoutByZones(input, noEdges));
  assert.deepEqual(a, b);
  // Nao muta o input (clone de posicoes).
  assert.equal(input[0].position.x, 9999);
});

test("autoLayoutByZones: sem NaN em posicoes", async () => {
  const { autoLayoutByZones } = await import("./auto-layout");
  for (const n of autoLayoutByZones(input, noEdges)) {
    assert.ok(Number.isFinite(n.position.x), `${n.id}.x`);
    assert.ok(Number.isFinite(n.position.y), `${n.id}.y`);
  }
});

test("autoLayoutByZones: colunas seguem LANE_ORDER (vpc antes de layer)", async () => {
  const { autoLayoutByZones } = await import("./auto-layout");
  const p = positions(autoLayoutByZones(input, noEdges));
  // vpc = 780 de largura default: vpc em x=40, proxima coluna em 40+780+24.
  assert.equal(p.vpc.x, 40);
  assert.equal(p.vpc.y, 40);
  assert.equal(p.layer.x, 40 + 780 + 24);
  assert.ok(p.vpc.x < p.layer.x);
});

test("autoLayoutByZones: filho fica dentro do contêiner; orfanos na linha y=600", async () => {
  const { autoLayoutByZones } = await import("./auto-layout");
  const p = positions(autoLayoutByZones(input, noEdges));
  // cy inicial = PAD + 24 = 56 (linha de cabecalho do contêiner).
  assert.deepEqual(p.c1, { x: 32, y: 56 });
  assert.deepEqual(p.o1, { x: 40, y: 600 });
});
