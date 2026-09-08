import assert from "node:assert/strict";
import test from "node:test";
import { draftLooksNewerThanServer, type LocalDraft } from "./local-draft.ts";

function draft(partial: Partial<LocalDraft> = {}): LocalDraft {
  return {
    id: "g1",
    graphId: "g1",
    projectId: "p1",
    name: "Draft",
    context: "",
    nfr: null,
    nodes: [{ id: "n1" } as never],
    edges: [],
    excalidraw_elements: [],
    savedAt: new Date().toISOString(),
    ...partial,
  };
}

test("draftLooksNewerThanServer: recovers when server empty", () => {
  assert.equal(draftLooksNewerThanServer(draft(), "2020-01-01T00:00:00Z", 0, 0), true);
});

test("draftLooksNewerThanServer: ignores empty draft", () => {
  assert.equal(
    draftLooksNewerThanServer(draft({ nodes: [], excalidraw_elements: [] }), null, 0, 0),
    false,
  );
});

test("draftLooksNewerThanServer: prefers newer draft with content", () => {
  const d = draft({
    savedAt: "2026-09-04T15:00:00.000Z",
    nodes: [{ id: "a" } as never, { id: "b" } as never],
  });
  assert.equal(draftLooksNewerThanServer(d, "2026-09-04T14:00:00.000Z", 1, 0), true);
});
