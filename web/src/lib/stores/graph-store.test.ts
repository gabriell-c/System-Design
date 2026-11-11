import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// Reescreve importadores relativos sem extensão no grafo do store
// ("../graph-store" → "../graph-store.ts" e seus imports transitivos) para
// rodar sob `node --experimental-strip-types --test`, sem alterar produção.
register(new URL("../../../test/ts-ext-hooks.mjs", import.meta.url));

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "../types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

function exEl(id: string): ExcalidrawElement {
  return { id } as unknown as ExcalidrawElement;
}

function archNode(id: string, label: string): Node<CanvasNodeData> {
  return {
    id,
    type: "arch",
    position: { x: 0, y: 0 },
    data: { kind: "arch", label, catalogId: "x", tech: "y", config: {} },
  } as unknown as Node<CanvasNodeData>;
}

async function loadStore() {
  const mod = await import("../graph-store");
  return mod.useGraphStore;
}

test("initial state shape (document/undo/save slices composed)", async () => {
  const store = await loadStore();
  const s = store.getInitialState();
  assert.equal(s.name, "Nova arquitetura");
  assert.equal(s.context, "");
  assert.equal(typeof s.nfr, "object");
  assert.equal(s.graphId, null);
  assert.equal(s.projectId, null);
  assert.deepEqual(s.nodes, []);
  assert.deepEqual(s.edges, []);
  assert.equal(s.selectedNodeId, null);
  assert.deepEqual(s.selectedNodeIds, []);
  assert.equal(s.selectedEdgeId, null);
  assert.deepEqual(s.excalidrawElements, []);
  assert.equal(s.selectedExcalidrawElementId, null);
  assert.equal(s._pendingNodesChanges, null);
  assert.deepEqual(s.past, []);
  assert.deepEqual(s.future, []);
  assert.equal(s.dirty, false);
  assert.equal(s.lastSavedAt, null);
  assert.equal(s.saveStatus, "saved");
  assert.equal(s.isLocked, false);
  assert.equal(s.lastEtag, null);
  assert.equal(s.analysis, null);
  assert.equal(s.userRole, "senior");
  assert.equal(s.architectureView, "all");
  // P4: _pendingTimeout saiu do state para escopo de módulo em document-slice.
  assert.ok(!("_pendingTimeout" in s), "_pendingTimeout não deve ser campo de state");
  // API pública preservada (mesmas chaves de ação).
  for (const action of ["undo", "redo", "applyRemote", "addNote", "renameNode", "loadGraph", "reset"] as const) {
    assert.equal(typeof s[action], "function", `state.${action} ausente`);
  }
});

test("document mutation pushes undo; undo/redo roundtrip", async () => {
  const store = await loadStore();
  store.getState().reset();
  const afterReset = store.getState();
  const pastBefore = afterReset.past.length; // 0 — reset limpa past/future

  afterReset.addNote({ x: 10, y: 20 }, "obs");
  const s1 = store.getState();
  assert.equal(s1.nodes.length, 1);
  assert.equal(s1.nodes[0].data.kind, "note");
  assert.equal(s1.dirty, true);
  assert.equal(s1.past.length, pastBefore + 1);
  assert.equal(s1.selectedNodeId, s1.nodes[0].id);
  assert.ok(s1.canUndo());

  assert.equal(s1.undo(), true);
  const s2 = store.getState();
  assert.equal(s2.nodes.length, 0);
  assert.equal(s2.past.length, pastBefore);
  assert.equal(s2.future.length, 1);
  assert.ok(s2.canRedo());

  assert.equal(s2.redo(), true);
  assert.equal(store.getState().nodes.length, 1);
});

test("applyRemote: sem undo, sem dirty, campos ausentes nunca sobrescrevem", async () => {
  const store = await loadStore();
  const localNodes = [archNode("A", "A"), archNode("B", "B")];
  const edgeAtoB: Edge = { id: "e1", source: "A", target: "B" };
  store.setState({
    name: "Local",
    context: "ctx-local",
    nodes: localNodes,
    edges: [edgeAtoB],
    dirty: false,
  });
  const before = store.getState();
  const pastLen = before.past.length;
  const futureLen = before.future.length;
  const excalidraw = before.excalidrawElements;
  const nfrBefore = before.nfr;

  // Payload só com nodes: arestas são filtradas por endpoint vivo, e os
  // demais campos ausentes (name/context/excalidrawElements/nfr) NÃO mudam.
  before.applyRemote({ nodes: [archNode("C", "C")] });
  const s1 = store.getState();
  assert.equal(s1.nodes.length, 1);
  assert.equal(s1.nodes[0].id, "C");
  assert.equal(s1.edges.length, 0, "aresta A→B perde os endpoints remotos e é descartada");
  assert.equal(s1.past.length, pastLen, "applyRemote não empurra undo");
  assert.equal(s1.future.length, futureLen, "applyRemote não toca future");
  assert.equal(s1.dirty, false, "applyRemote não marca dirty");
  assert.equal(s1.name, "Local");
  assert.equal(s1.context, "ctx-local");
  assert.equal(s1.excalidrawElements, excalidraw, "excalidrawElements só muda se o payload os carregar");
  assert.equal(s1.nfr, nfrBefore);

  // Payload explícito aplica e context: null vira "" (comportamento P2).
  s1.applyRemote({ name: "Remoto", context: null });
  const s2 = store.getState();
  assert.equal(s2.name, "Remoto");
  assert.equal(s2.context, "");
  assert.equal(s2.nodes[0].id, "C", "nodes ausente no 2º payload não sobrescreve");
  assert.equal(s2.past.length, pastLen, "continuou sem undo");
});

test("nextId: única em burst e preserva prefixo do kind", async () => {
  const { nextId } = await import("./helpers");
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(nextId("free"));
  assert.equal(seen.size, 1000, "1000 IDs em burst devem ser distintos");
  for (const prefix of ["block", "zone", "lane", "note", "cidr", "tenant"]) {
    const id = nextId(prefix);
    assert.ok(id.startsWith(`${prefix}-`), `ID de ${prefix} deve começar com '${prefix}-'`);
  }
});

test("applyRemote: payload só com arestas descarta orfãs dos nós locais", async () => {
  const store = await loadStore();
  store.setState({ nodes: [archNode("A", "A"), archNode("B", "B")], edges: [] });
  const orphan: Edge = { id: "e-orphan", source: "X", target: "Y" };
  const live: Edge = { id: "e-live", source: "A", target: "B" };
  store.getState().applyRemote({ edges: [orphan, live] });
  const s = store.getState();
  assert.deepEqual(
    s.edges.map((e) => e.id),
    ["e-live"],
    "só a aresta com endpoints locais sobrevive; a orfã é descartada",
  );
  assert.equal(s.nodes.length, 2, "nós locais ficam intactos");
});

test("undo/redo restauram excalidrawElements e selectedNodeIds", async () => {
  const store = await loadStore();
  store.getState().reset();
  const base = store.getState().past.length; // reset() não zera history (passa por withHistory)
  // Base: cena [ex-1] + multi-seleção [n1, n2] (sem passar por history).
  store.setState({ excalidrawElements: [exEl("ex-1")], selectedNodeIds: ["n1", "n2"] });
  // Uma mutação que empurra history captura o snapshot acima.
  store.getState().setName("com-historico");
  assert.equal(store.getState().past.length, base + 1);
  // Estado corrente diferente, definido SEM history.
  store.setState({ excalidrawElements: [exEl("ex-9")], selectedNodeIds: [] });
  assert.equal(store.getState().undo(), true);
  const undone = store.getState();
  assert.deepEqual(undone.excalidrawElements, [exEl("ex-1")], "undo restaura cena anterior");
  assert.deepEqual(undone.selectedNodeIds, ["n1", "n2"], "undo restaura multi-seleção");
  assert.equal(store.getState().redo(), true);
  assert.deepEqual(store.getState().excalidrawElements, [exEl("ex-9")], "redo volta à cena corrente");
  assert.deepEqual(store.getState().selectedNodeIds, [], "redo volta à seleção corrente");
});

function fixtureAnalysis() {
  return {
    score: 7.5,
    summary: "ok",
    strengths: [],
    risks: [],
    suggestions: [],
    findings: [],
    node_scores: {},
    growth: {
      small: { ok: true, issues: [], changes: [] },
      medium: { ok: true, issues: [], changes: [] },
      large: { ok: true, issues: [], changes: [] },
    },
    ia_ok: false,
    ia_unavailable: true,
    agents_used: [],
  };
}

test("runAnalyze: chama api.analyze com o estado atual e atualiza analysis/nota", async () => {
  const store = await loadStore();
  store.getState().reset();
  store.setState({ nodes: [archNode("A", "Srv A")], edges: [] });
  store.getState().setAnalyzing(false, "erro anterior");
  assert.equal(store.getState().analyzeError, "erro anterior");

  const realFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(fixtureAnalysis()), { status: 200, statusText: "OK" });
  }) as typeof fetch;
  try {
    await store.getState().runAnalyze();
    const s = store.getState();
    assert.equal(s.analyzing, false, "volta a false ao final");
    assert.equal(s.analyzeError, null, "erro anterior é limpo no início");
    assert.equal(s.analysis?.score, 7.5);
    assert.equal(s.highlightNodeIds.length, 0);
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.url ?? "", /\/api\/v1\/analyze$/);
    assert.equal((calls[0]?.body as { nodes?: unknown[] } | undefined)?.nodes?.length, 1);
    assert.equal(s.uiNotice?.text, "Análise pronta (heurística local) · nota 7.5. Veja a aba Análise.");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("runAnalyze: falha na request → analyzeError preenchido, analyzing false, notice de erro", async () => {
  const store = await loadStore();
  store.getState().reset();
  store.setState({ nodes: [archNode("A", "Srv A")] });

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ detail: "500 boom" }), { status: 500, statusText: "Internal Server Error" })) as typeof fetch;
  try {
    await store.getState().runAnalyze();
    const s = store.getState();
    assert.equal(s.analyzing, false);
    assert.equal(s.analyzeError, "500 boom");
    assert.equal(s.analysis, null, "falha não seta analysis");
    assert.equal(s.uiNotice?.type, "error");
    assert.match(s.uiNotice?.text ?? "", /500 boom/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("runAnalyze: sem nós é no-op (não chama fetch, não altera analyzing)", async () => {
  const store = await loadStore();
  store.getState().reset();

  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    called = true;
    return new Response(JSON.stringify(fixtureAnalysis()), { status: 200, statusText: "OK" });
  }) as typeof fetch;
  try {
    await store.getState().runAnalyze();
    assert.equal(called, false, "fetch não deve ser chamado sem nós");
    assert.equal(store.getState().analyzing, false);
    assert.equal(store.getState().analyzeError, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
