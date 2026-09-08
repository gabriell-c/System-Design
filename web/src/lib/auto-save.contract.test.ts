import assert from "node:assert/strict";
import test from "node:test";

/**
 * Espelha a logica de fingerprint usada no auto-save para detectar
 * edicoes durante o PUT (race dirty).
 */
function contentFingerprint(payload: {
  nodes: unknown[];
  edges: unknown[];
  excalidraw_elements: unknown[];
  name: string;
}): string {
  return JSON.stringify({
    nodes: payload.nodes,
    edges: payload.edges,
    ex: payload.excalidraw_elements,
    name: payload.name,
  });
}

test("fingerprint muda quando excalidraw muda", () => {
  const a = contentFingerprint({
    name: "P",
    nodes: [],
    edges: [],
    excalidraw_elements: [{ id: "1", version: 1 }],
  });
  const b = contentFingerprint({
    name: "P",
    nodes: [],
    edges: [],
    excalidraw_elements: [{ id: "1", version: 2 }],
  });
  assert.notEqual(a, b);
});

test("fingerprint estavel para mesmo payload", () => {
  const payload = {
    name: "P",
    nodes: [{ id: "n1" }],
    edges: [],
    excalidraw_elements: [],
  };
  assert.equal(contentFingerprint(payload), contentFingerprint(payload));
});

test("debounce gap: 2500ms e periodico 30000ms sao constantes esperadas", () => {
  // Documenta o contrato do useAutoSave — se mudar, atualizar este teste.
  const DIRTY_SERVER_SAVE_MS = 2_500;
  const PERIODIC_BACKUP_MS = 30_000;
  assert.ok(DIRTY_SERVER_SAVE_MS < 5_000);
  assert.ok(PERIODIC_BACKUP_MS <= 60_000);
});
