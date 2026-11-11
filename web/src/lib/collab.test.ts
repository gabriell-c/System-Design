import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { mergeGraphSnapshots } from "./collab.ts";

// Reescreve importadores relativos sem extensão ("./graph-store") para ".ts"
// no import dinâmico abaixo — os módulos de produção usam specifiers sem extensão.
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

type T = ReadonlySet<string>;
const none: T = new Set();
const id = (s: string) => [s];

/**
 * Merge element-wise (LWW por id):
 * - localTouched = ids criados/alterados localmente desde o último merge remoto;
 * - id tocado localmente vence; id não tocado cede para o remoto (incluindo remoção);
 * - excalidraw preservado (união quando remoto carrega elementos).
 */

test("merge: local touched node wins over concurrent remote edit (LWW)", () => {
  const local = {
    nodes: [{ id: "a", label: "local-v2" }, { id: "b", label: "shared" }],
    edges: [{ id: "e1", source: "a", target: "b" }],
    excalidrawElements: [{ id: "x", type: "rectangle", x: 1 }],
  };
  const remote = {
    nodes: [{ id: "a", label: "remote-v1" }, { id: "b", label: "remote-b" }],
    edges: [{ id: "e2", source: "b", target: "c" }],
    excalidrawElements: [{ id: "y", type: "line", x: 2 }],
  };
  const merged = mergeGraphSnapshots(local, remote, { nodes: new Set(id("a")), edges: none });
  // "a" tocado localmente → versão local vence; "b" não tocado → remota vence.
  assert.deepEqual(
    merged.nodes.map((n) => (n as { label: string }).label),
    ["local-v2", "remote-b"],
  );
});

test("merge: remote delete removes untouched local node", () => {
  const local = {
    nodes: [{ id: "a" }, { id: "gone" }],
    edges: [{ id: "e-gone", source: "gone", target: "a" }],
  };
  const remote = { nodes: [{ id: "a" }], edges: [] };
  const merged = mergeGraphSnapshots(local, remote, { nodes: none, edges: none });
  assert.deepEqual(merged.nodes.map((n) => (n as { id: string }).id), ["a"]);
  assert.deepEqual(merged.edges, []);
});

test("merge: remote-only elements enter the local state", () => {
  const local = { nodes: [{ id: "a" }], edges: [] };
  const remote = { nodes: [{ id: "a" }, { id: "remote-new" }], edges: [{ id: "e-r", source: "a", target: "remote-new" }] };
  const merged = mergeGraphSnapshots(local, remote, { nodes: none, edges: none });
  assert.deepEqual(merged.nodes.map((n) => (n as { id: string }).id), ["a", "remote-new"]);
  assert.deepEqual(merged.edges.map((e) => (e as { id: string }).id), ["e-r"]);
});

test("merge: unrelated local elements are never clobbered", () => {
  const local = {
    nodes: [
      { id: "touched", label: "mine" },
      { id: "untouched-shared", label: "old" },
      { id: "local-only" },
    ],
    edges: [],
  };
  const remote = {
    nodes: [
      { id: "touched", label: "theirs" },
      { id: "untouched-shared", label: "newer" },
    ],
    edges: [],
  };
  const merged = mergeGraphSnapshots(local, remote, {
    nodes: new Set(id("touched")),
    edges: none,
  });
  const byId = new Map(merged.nodes.map((n) => [(n as { id: string }).id, n as { label?: string }]));
  assert.equal(byId.get("touched")?.label, "mine"); // LWW local
  assert.equal(byId.get("untouched-shared")?.label, "newer"); // remoto venceu
  assert.equal(byId.has("local-only"), false); // remoto não o enviou → removido
});

test("merge: excalidraw elements are preserved when remote omits them", () => {
  const local = {
    nodes: [],
    edges: [],
    excalidrawElements: [{ id: "x", type: "rectangle" }],
  };
  const remote = { nodes: [{ id: "n" }], edges: [] };
  const merged = mergeGraphSnapshots(local, remote, { nodes: none, edges: none });
  assert.deepEqual(merged.excalidrawElements, [{ id: "x", type: "rectangle" }]);
});

test("merge: excalidraw union when remote carries elements", () => {
  const local = {
    nodes: [],
    edges: [],
    excalidrawElements: [{ id: "x" }, { id: "shared", v: 1 }],
  };
  const remote = {
    nodes: [],
    edges: [],
    excalidrawElements: [{ id: "shared", v: 2 }, { id: "y" }],
  };
  const merged = mergeGraphSnapshots(local, remote, { nodes: none, edges: none });
  const ids = merged.excalidrawElements.map((e) => (e as { id: string }).id);
  // locais primeiro; "shared" local (v:1) fica, remoto adiciona "y"
  assert.deepEqual(ids, ["x", "shared", "y"]);
});

// ── applyRemote: store-level — no undo entry, no dirty flag ────────────────

test("applyRemote: updates nodes/edges without undo, without dirty, without clearing excalidraw", async () => {
  const { useGraphStore } = await import("./graph-store");
  const store = () => useGraphStore.getState();

  const excalidrawSample = [{ id: "exc-1", type: "rectangle", x: 0, y: 0 } as never];
  useGraphStore.setState({
    nodes: [{ id: "a", type: "arch", data: { kind: "arch", catalogId: "db", label: "A" } } as never],
    edges: [],
    excalidrawElements: excalidrawSample,
    dirty: false,
    past: [],
    future: [],
  });

  store().applyRemote({
    nodes: [{ id: "b", type: "arch", data: { kind: "arch", catalogId: "cache", label: "B" } } as never],
    edges: [],
  });

  const s = store();
  assert.deepEqual(s.nodes.map((n) => n.id), ["b"]);
  assert.equal(s.dirty, false, "remote apply must NOT mark dirty (nada de auto-save alheio)");
  assert.equal(s.past.length, 0, "remote apply must NOT push undo entries");
  assert.deepEqual(s.excalidrawElements, excalidrawSample, "excalidraw untouched when payload omits it");
});

test("applyRemote: omits fields → state untouched", async () => {
  const { useGraphStore } = await import("./graph-store");
  const before = useGraphStore.getState();
  useGraphStore.setState({ dirty: false, past: [] });
  useGraphStore.getState().applyRemote({});
  const after = useGraphStore.getState();
  assert.equal(after.nodes, before.nodes, "empty payload must not replace nodes");
  assert.equal(after.excalidrawElements, before.excalidrawElements);
  assert.equal(after.dirty, false);
});
