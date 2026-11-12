import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// Reescreve importadores relativos sem extensão no grafo do store
// ("../graph-store" → "../graph-store.ts" e seus imports transitivos) para
// rodar sob `node --experimental-strip-types --test`, sem alterar produção.
register(new URL("../../../test/ts-ext-hooks.mjs", import.meta.url));

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, GraphRecord } from "../types";
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

/**
 * S3a — testes de blast/análise (item 1/13) e lastInjection (item 5).
 * `highlightCriticalPath` precisa de arestas marcadas (isCriticalPath) ou
 * com flowNumber; sem nós/arestas no grafo ela produz caminho vazio,
 * então os testes semeiam o estado de forma direta.
 */
test("S3a: loadGraph limpa estado de blast/highlight (regressão item 1)", async () => {
  const store = await loadStore();
  store.getState().reset();
  // Simula o gráfico A com highlight/blast ativos + última injeção.
  store.setState({ graphId: "A", nodes: [archNode("A", "A")] });
  store.getState().setBlastRadiusHighlight({
    unreachable: ["A"],
    degraded: [],
    edgeIds: ["e-A"],
    labels: { unreachable: ["A"], degraded: [] },
  });
  store.getState().setLastInjection({ graphId: "A", nodeId: "A", nodeLabel: "A", mode: "down" });
  store.setState({ highlightNodeIds: ["A"], blastHighlightEdgeIds: ["e-A"] });

  // Troca para o gráfico B — nenhum estado de A pode sobreviver.
  store.getState().loadGraph({ id: "B", name: "B" } as unknown as GraphRecord);
  const s = store.getState();
  assert.equal(s.graphId, "B");
  assert.deepEqual(s.blastUnreachableIds, [], "blastUnreachableIds deve zerar na troca");
  assert.deepEqual(s.blastDegradedIds, [], "blastDegradedIds deve zerar na troca");
  assert.deepEqual(s.blastEdgeIds, [], "blastEdgeIds deve zerar na troca");
  assert.equal(s.blastLabels, null, "blastLabels deve zerar na troca");
  assert.equal(s.lastInjection, null, "lastInjection deve zerar na troca");
  assert.deepEqual(s.highlightNodeIds, [], "highlightNodeIds deve zerar na troca");
  assert.deepEqual(s.blastHighlightEdgeIds, [], "blastHighlightEdgeIds deve zerar na troca");
});

test("S3a: loadSnapshot e reset também limpam estado de blast", async () => {
  const store = await loadStore();
  store.getState().reset();
  store.getState().setBlastRadiusHighlight({
    unreachable: ["X"],
    degraded: ["Y"],
    edgeIds: ["e"],
    labels: { unreachable: ["X"], degraded: ["Y"] },
  });
  store.getState().setLastInjection({ graphId: "G", nodeId: "X", nodeLabel: "X", mode: "timeout" });

  store.getState().loadSnapshot("snap", [archNode("C", "C")], []);
  let s = store.getState();
  assert.deepEqual(s.blastUnreachableIds, []);
  assert.equal(s.lastInjection, null);

  store.getState().setBlastRadiusHighlight({ unreachable: ["Z"], degraded: [] });
  s = store.getState();
  assert.deepEqual(s.blastUnreachableIds, ["Z"]);
  store.getState().reset();
  s = store.getState();
  assert.deepEqual(s.blastUnreachableIds, [], "reset zera blast");
  assert.equal(s.blastLabels, null, "reset zera blastLabels");
  assert.equal(s.lastInjection, null, "reset zera lastInjection");
});

test("S3a: clear de blast NÃO apaga highlight de análise (independência, item 13)", async () => {
  const store = await loadStore();
  store.getState().reset();
  // Semeia um caminho crítico real (aresta isCriticalPath) p/ a análise ter estado.
  const critEdge: Edge = { id: "e-crit", source: "A", target: "B", data: { isCriticalPath: true } };
  store.setState({ nodes: [archNode("A", "A"), archNode("B", "B")], edges: [critEdge] });
  store.getState().highlightCriticalPath();
  store
    .getState()
    .setBlastRadiusHighlight({ unreachable: ["A"], degraded: ["B"], edgeIds: ["e-blast"] });

  // Limpar blast deve preservar o highlight do caminho crítico.
  store.getState().clearBlastRadiusHighlight();
  const s = store.getState();
  assert.deepEqual(s.blastUnreachableIds, [], "blast limpo");
  assert.deepEqual(s.blastEdgeIds, [], "blastEdgeIds limpo");
  assert.equal(s.blastLabels, null);
  // Os campos de análise (donos no analysis-slice) NÃO foram tocados.
  assert.notDeepEqual(s.highlightNodeIds, [], "highlightNodeIds da análise sobreviveu ao clear de blast");
  assert.notDeepEqual(s.blastHighlightEdgeIds, [], "blastHighlightEdgeIds da análise sobreviveu ao clear de blast");
});

test("S3a: setBlastRadiusHighlight não sobrepõe highlight de análise", async () => {
  const store = await loadStore();
  store.getState().reset();
  const critEdge: Edge = { id: "e-crit", source: "A", target: "B", data: { isCriticalPath: true } };
  store.setState({ nodes: [archNode("A", "A"), archNode("B", "B")], edges: [critEdge] });
  store.getState().highlightCriticalPath();
  const analysisNodes = [...store.getState().highlightNodeIds];
  const analysisEdges = [...store.getState().blastHighlightEdgeIds];
  assert.ok(analysisNodes.length > 0 && analysisEdges.length > 0, "pré: caminho crítico ativo");

  store
    .getState()
    .setBlastRadiusHighlight({ unreachable: ["B"], degraded: [], edgeIds: ["e-blast"], labels: { unreachable: ["B"], degraded: [] } });
  const s = store.getState();
  // Estado de blast é autocontido — não escreve nos campos da análise.
  assert.deepEqual(s.blastEdgeIds, ["e-blast"], "blastEdgeIds recebeu as arestas do blast");
  assert.deepEqual(s.highlightNodeIds, analysisNodes, "injeção não sobrepôs highlightNodeIds");
  assert.deepEqual(s.blastHighlightEdgeIds, analysisEdges, "injeção não sobrepôs arestas do crítico");

  // E limpar a análise não afeta o blast.
  store.getState().clearCriticalPathHighlight();
  const s2 = store.getState();
  assert.deepEqual(s2.highlightNodeIds, []);
  assert.deepEqual(s2.blastHighlightEdgeIds, []);
  assert.deepEqual(s2.blastEdgeIds, ["e-blast"], "blast sobreviveu ao clear da análise");
});

test("S3a: setLastInjection grava/limpa por graphId (reidratação, item 5)", async () => {
  const store = await loadStore();
  store.getState().reset();
  assert.equal(store.getState().lastInjection, null);
  store.getState().setLastInjection({ graphId: "G1", nodeId: "n", nodeLabel: "Svc", mode: "degraded" });
  assert.deepEqual(store.getState().lastInjection, {
    graphId: "G1",
    nodeId: "n",
    nodeLabel: "Svc",
    mode: "degraded",
  });
  store.getState().setLastInjection(null);
  assert.equal(store.getState().lastInjection, null);
});
