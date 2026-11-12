import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// Reescreve importadores relativos sem extensão (hook transitivo da cadeia
// `@/lib/graph-store`) para rodar sob `node --experimental-strip-types --test`.
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

// Stub de localStorage ANTES do import do módulo em teste: os helpers de
// config por grafo leem/escrevem direto na global (item 14).
const backing = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => (backing.has(k) ? (backing.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      backing.set(k, String(v));
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
    clear: () => backing.clear(),
  },
});

const {
  clampSeed,
  clampRealism,
  formatPct,
  isStaleRun,
  nextScenarioName,
  modeLabel,
  loadSimSettings,
  readSimNumberSetting,
  readSimModeSetting,
  writeSimNumberSetting,
  writeSimModeSetting,
  SIM_EMPTY_CANVAS_MESSAGE,
  DEFAULT_SIM_REALISM,
} = await import("./useSimulation");

test("clampSeed: inteiro não-negativo; NaN/negativo → 0 (item 21)", () => {
  assert.equal(clampSeed(42), 42);
  assert.equal(clampSeed(42.9), 42);
  assert.equal(clampSeed(-3), 0);
  assert.equal(clampSeed(Number.NaN), 0);
  assert.equal(clampSeed(Number.POSITIVE_INFINITY), 0);
});

test("clampRealism: clamp em [0,1]; fora do domínio → default 0.65", () => {
  assert.equal(clampRealism(0.5), 0.5);
  assert.equal(clampRealism(1.4), 1);
  assert.equal(clampRealism(-0.2), 0);
  assert.equal(clampRealism(Number.NaN), DEFAULT_SIM_REALISM);
});

test("formatPct: precisão explícita e única fonte de '65%'/1 decimal (item 21)", () => {
  assert.equal(formatPct(0.65, 0), "65%");
  assert.equal(formatPct(0.65), "65.0%");
  assert.equal(formatPct(0.333, 1), "33.3%");
  assert.equal(formatPct(1, 0), "100%");
});

test("isStaleRun: abort ou troca de gráfico → descartar (item 7)", () => {
  assert.equal(isStaleRun("A", "A", false), false, "mesmo grafo, não abortou → válido");
  assert.equal(isStaleRun("A", "B", false), true, "gráfico trocou no meio → stale");
  assert.equal(isStaleRun("A", "A", true), true, "abortado → stale");
  assert.equal(isStaleRun(null, null, false), false, "grafo rascunho (null) estável");
});

test("nextScenarioName: maior índice + 1, sem colisão pós-delete (item 15)", () => {
  assert.equal(nextScenarioName([]), "Cenário 1");
  assert.equal(nextScenarioName([{ name: "Cenário 1" }]), "Cenário 2");
  assert.equal(nextScenarioName([{ name: "Cenário 2" }, { name: "Cenário 1" }]), "Cenário 3");
  // Nomes customizados não quebram a numeração
  assert.equal(nextScenarioName([{ name: "Black Friday" }, { name: "Cenário 5" }]), "Cenário 6");
  // "Cenário 10" conta como índice 10 (não 1)
  assert.equal(nextScenarioName([{ name: "Cenário 10" }]), "Cenário 11");
});

test("modeLabel: fonte única load/stress/soak (item 21)", () => {
  assert.equal(modeLabel("load"), "Load");
  assert.equal(modeLabel("stress"), "Stress");
  assert.equal(modeLabel("soak"), "Soak");
  assert.equal(modeLabel("outro"), "Load");
});

test("SIM_EMPTY_CANVAS_MESSAGE: mensagem única p/ canvas vazio (item 21)", () => {
  assert.match(SIM_EMPTY_CANVAS_MESSAGE, /componentes/);
});

test("config por grafo: seed/realism escopados + migração da chave global (item 14)", () => {
  backing.clear();
  // Escopo por grafo: g1 não vaza p/ g2
  writeSimNumberSetting("seed", "g1", 7);
  assert.equal(readSimNumberSetting("seed", "g1", 42), 7);
  assert.equal(readSimNumberSetting("seed", "g2", 42), 42, "g2 não herda seed de g1");

  // Migração: lê a chave global UMA vez e grava no escopo do grafo
  backing.set("archia-sim-realism", "0.3");
  assert.equal(readSimNumberSetting("realism", "g1", 0.65), 0.3, "global migra p/ g1");
  assert.ok(backing.has("archia-sim-realism-g1"), "migração grava no escopo do grafo");
  backing.delete("archia-sim-realism-g1");
  // Sem escopo, re-migra de novo (semântica documentada: global é fallback
  // apenas até a primeira escrita do escopo)
  assert.equal(readSimNumberSetting("realism", "g1", 0.65), 0.3);

  // Modo escopado + migração
  backing.set("archia-sim-mode", "soak");
  assert.equal(readSimModeSetting("g1"), "soak");
  assert.ok(backing.has("archia-sim-mode-g1"));
  writeSimModeSetting("g2", "stress");
  assert.equal(readSimModeSetting("g2"), "stress");

  // Grafo rascunho (graphId null) usa sufixo "draft"
  writeSimNumberSetting("seed", null, 99);
  assert.equal(backing.get("archia-sim-seed-draft"), "99");
  assert.equal(readSimNumberSetting("seed", null, 42), 99);

  // Sem nenhum storage (nem global) → defaults
  backing.clear();
  assert.equal(readSimModeSetting("g3"), "load", "sem storage → default");
});

test("loadSimSettings: defaults quando não há storage (item 18/14)", () => {
  backing.clear();
  const s = loadSimSettings("gX");
  assert.equal(s.seed, 42);
  assert.equal(s.realism, DEFAULT_SIM_REALISM);
  assert.equal(s.testMode, "load");
});
