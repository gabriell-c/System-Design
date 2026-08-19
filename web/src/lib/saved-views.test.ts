import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CANVAS_FILTER } from "./canvas-filter.ts";
import { deleteSavedView, listSavedViews, saveSavedView } from "./saved-views.ts";

function withMockStorage(run: () => void) {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { value: mock, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "localStorage", { value: prev, configurable: true });
  }
}

test("saved views CRUD and legacy filter normalization", () => {
  withMockStorage(() => {
    localStorage.setItem(
      "archia-saved-views:draft",
      JSON.stringify([
        {
          id: "v1",
          name: "Legacy",
          tags: ["pii"],
          filter: {
            query: "ads",
            kind: "all",
            zoneKind: "all",
            provider: "all",
            layerView: "all",
            ownerTeam: "",
            catalogId: "",
          },
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const views = listSavedViews(null);
    assert.equal(views.length, 1);
    assert.equal(views[0]?.filter.piiSensitivity, "all");
    assert.equal(views[0]?.filter.c4Level, "all");

    const created = saveSavedView(null, {
      name: "PII high",
      tags: ["pii"],
      filter: { ...EMPTY_CANVAS_FILTER, piiSensitivity: "high" },
    });
    assert.equal(created.name, "PII high");
    assert.equal(listSavedViews(null).length, 2);
    assert.equal(deleteSavedView(null, created.id), true);
    assert.equal(listSavedViews(null).length, 1);
  });
});
