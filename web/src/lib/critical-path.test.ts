import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// Resolver hook: reescreve imports relativos sem extensão ("./edges" → "./edges.ts")
// para rodar sob `node --experimental-strip-types --test`.
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";

function edge(id: string, source: string, target: string, data?: Record<string, unknown>): Edge {
  return { id, source, target, data } as unknown as Edge;
}
const noNodes: Node<CanvasNodeData>[] = [];

type CriticalPathCase = {
  name: string;
  edges: Edge[];
  expectedEdgeIds: string[];
  expectedNodeIds: string[];
};

const cases: CriticalPathCase[] = [
  {
    name: "grafo vazio devolve resultado vazio",
    edges: [],
    expectedEdgeIds: [],
    expectedNodeIds: [],
  },
  {
    name: "aresta marcada isCriticalPath entra com seus endpoints",
    edges: [
      edge("e1", "A", "B", { isCriticalPath: true }),
      edge("e2", "B", "C"),
    ],
    expectedEdgeIds: ["e1"],
    expectedNodeIds: ["A", "B"],
  },
  {
    name: "duas arestas marcadas compartilham no -> uniao de nodeIds",
    edges: [
      edge("e1", "A", "B", { isCriticalPath: true }),
      edge("e2", "B", "C", { isCriticalPath: true }),
    ],
    expectedEdgeIds: ["e1", "e2"],
    expectedNodeIds: ["A", "B", "C"],
  },
  {
    name: "sem marcacao: fallback pelos flowNumber (ordem ascendente)",
    edges: [
      edge("f3", "A", "B", { flowNumber: 3 }),
      edge("f1", "B", "C", { flowNumber: 1 }),
      edge("f2", "C", "D", { flowNumber: 2 }),
    ],
    expectedEdgeIds: ["f1", "f2", "f3"],
    expectedNodeIds: ["B", "C", "A", "D"],
  },
  {
    name: "sem marcacao: ate 5 arestas do fallback",
    edges: Array.from({ length: 7 }, (_, i) =>
      edge(`f${i + 1}`, "S", `T${i}`, { flowNumber: i + 1 }),
    ),
    expectedEdgeIds: ["f1", "f2", "f3", "f4", "f5"],
    expectedNodeIds: ["S", "T0", "T1", "T2", "T3", "T4"],
  },
];

test("computeCriticalPath — tabela de casos", async () => {
  const { computeCriticalPath } = await import("./critical-path");
  for (const c of cases) {
    const r = computeCriticalPath(noNodes, c.edges);
    assert.deepEqual(r.edgeIds, c.expectedEdgeIds, c.name);
    // nodeIds e uniao n-ordenada; compara como conjunto.
    assert.deepEqual(
      [...r.nodeIds].sort(),
      [...c.expectedNodeIds].sort(),
      c.name,
    );
  }
});
