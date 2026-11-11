import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";
import type { GraphSnapshot } from "./stores/types";

// sessionStorage não existe no Node — shim em memória, configurável.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
(globalThis as Record<string, unknown>).sessionStorage = new MemoryStorage();

let nfrFixture: GraphSnapshot["nfr"] | null = null;

function snap(label: string, count = 1): GraphSnapshot {
  return {
    name: label,
    context: "ctx",
    nfr: nfrNow(),
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `${label}-${i}`,
      type: "arch",
      position: { x: 0, y: 0 },
      data: { kind: "arch", label: `${label} ${i}`, catalogId: "x", tech: "y", config: {} },
    })) as unknown as Node<CanvasNodeData>[],
    edges: [],
    selectedNodeId: null,
  };
}

async function load() {
  const [hist, g, nfrMod] = await Promise.all([
    import("./history-store"),
    import("./graph-store"),
    import("./nfr"),
  ]);
  nfrFixture = nfrMod.emptyNfr();
  return { hist, store: g.useGraphStore };
}

function nfrNow(): GraphSnapshot["nfr"] {
  return nfrFixture ?? ({ users_per_day: 0 } as GraphSnapshot["nfr"]);
}

test("undo/redo de mutações de grafo via facade", async () => {
  const { hist, store } = await load();
  store.setState({ graphId: "g-hist", nodes: [], edges: [], past: [], future: [], dirty: false });

  store.getState().addNote("nota nova");
  assert.equal(store.getState().nodes.length, 1);
  assert.equal(store.getState().past.length, 1);

  assert.equal(hist.undo(), true);
  assert.equal(store.getState().nodes.length, 0);
  assert.equal(store.getState().future.length, 1);
  assert.equal(store.getState().dirty, true);

  assert.equal(hist.redo(), true);
  assert.equal(store.getState().nodes.length, 1);
  assert.equal(hist.redo(), false);
  assert.equal(hist.undo(), true);
  assert.equal(hist.undo(), false);
});

test("canUndo/canRedo refletem past/future", async () => {
  const { hist, store } = await load();
  store.setState({ past: [], future: [] });
  assert.equal(hist.canUndo(), false);
  assert.equal(hist.canRedo(), false);
  store.setState({ past: [snap("a")], future: [snap("b")] });
  assert.equal(hist.canUndo(), true);
  assert.equal(hist.canRedo(), true);
});

test("persistHistory + restoreHistory roundtrip por graphId", async () => {
  const { hist, store } = await load();
  store.setState({ graphId: "g1", past: [snap("a")], future: [] });
  hist.persistHistory();

  // Simula remount: estado zerado, histórico só em sessionStorage.
  store.setState({ past: [], future: [] });
  assert.equal(hist.restoreHistory("g1"), true);
  assert.equal(store.getState().past.length, 1);

  assert.equal(hist.restoreHistory("g1"), true);
  // restoreIdempotente: mesmo conteúdo.
  assert.equal(store.getState().past.length, 1);
});

test("clear on load: graphId diferente não herda histórico do outro", async () => {
  const { hist, store } = await load();
  store.setState({ graphId: "g1", past: [snap("a")], future: [] });
  hist.persistHistory();

  store.setState({ graphId: "g2", past: [], future: [] });
  assert.equal(hist.restoreHistory("g2"), false);
  assert.deepEqual(store.getState().past, []);
});
