"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { SimulationPreset, SimulationResult, TestMode } from "@/lib/simulation";

/**
 * S3a — config de simulação escopada por gráfico (item 14):
 * `archia-sim-{kind}-{graphId}`. Gráfico sem salvar (graphId null) usa o
 * sufixo "draft". Nas primeiras leituras, a chave global legado
 * (`archia-sim-{kind}`) é lida uma vez e gravada na chave do gráfico
 * (migração).
 */
const SIM_SETTING_GLOBAL_KEYS = {
  seed: "archia-sim-seed",
  realism: "archia-sim-realism",
  mode: "archia-sim-mode",
} as const;

export type SimSettingKind = keyof typeof SIM_SETTING_GLOBAL_KEYS;

function scopedSimKey(kind: SimSettingKind, graphId: string | null): string {
  return `archia-sim-${kind}-${graphId ?? "draft"}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Clamp da semente: inteiro não-negativo (NaN → 0). Exportado p/ teste. */
export function clampSeed(value: number): number {
  const n = Math.trunc(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Clamp do realismo: [0, 1] (fora disso → default 0.65). Exportado p/ teste. */
export function clampRealism(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SIM_REALISM;
  return Math.min(1, Math.max(0, value));
}

export const DEFAULT_SIM_REALISM = 0.65;

export function readSimNumberSetting(kind: "seed" | "realism", graphId: string | null, fallback: number): number {
  const store = safeStorage();
  if (store) {
    const scopedKey = scopedSimKey(kind, graphId);
    const scoped = store.getItem(scopedKey);
    if (scoped != null) {
      const n = Number(scoped);
      if (Number.isFinite(n)) return n;
    }
    // Migração (item 14): lê a chave global UMA vez e grava no escopo do
    // gráfico — a chave global nunca é lida de novo depois da primeira escrita.
    const global = store.getItem(SIM_SETTING_GLOBAL_KEYS[kind]);
    if (global != null) {
      const n = Number(global);
      if (Number.isFinite(n)) {
        try {
          store.setItem(scopedKey, global);
        } catch {
          /* storage bloqueado — segue com o valor em memória */
        }
        return n;
      }
    }
  }
  return fallback;
}

export function readSimModeSetting(graphId: string | null): TestMode {
  const store = safeStorage();
  if (store) {
    const scopedKey = scopedSimKey("mode", graphId);
    const scoped = store.getItem(scopedKey);
    if (scoped === "load" || scoped === "stress" || scoped === "soak") return scoped;
    const global = store.getItem(SIM_SETTING_GLOBAL_KEYS.mode);
    if (global === "stress" || global === "soak") {
      try {
        store.setItem(scopedKey, global);
      } catch {
        /* storage bloqueado — segue com o valor em memória */
      }
      return global;
    }
  }
  return "load";
}

export function writeSimNumberSetting(kind: "seed" | "realism", graphId: string | null, value: number): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(scopedSimKey(kind, graphId), String(value));
  } catch {
    /* SSR/private mode — silencioso de propósito */
  }
}

export function writeSimModeSetting(graphId: string | null, mode: TestMode): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(scopedSimKey("mode", graphId), mode);
  } catch {
    /* SSR/private mode — silencioso de propósito */
  }
}

export type SimSettings = {
  seed: number;
  realism: number;
  testMode: TestMode;
};

export function loadSimSettings(graphId: string | null): SimSettings {
  return {
    seed: readSimNumberSetting("seed", graphId, 42),
    realism: clampRealism(readSimNumberSetting("realism", graphId, DEFAULT_SIM_REALISM)),
    testMode: readSimModeSetting(graphId),
  };
}

/*
 * S3a (item 21) — fonte única de mensagens/labels para painel + hook:
 */
export const SIM_EMPTY_CANVAS_MESSAGE = "Adicione componentes no canvas antes de simular.";

/** Labels curtos dos modos (fonte única — o painel compõe "X Test" a partir daqui). */
export function modeLabel(mode: string): string {
  if (mode === "stress") return "Stress";
  if (mode === "soak") return "Soak";
  return "Load";
}

/**
 * S3a (item 21) — formatador único de percentuais com precisão explícita.
 * `formatPct(0.65, 0)` → "65%"; `formatPct(0.333)` → "33.3%".
 */
export function formatPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** S3a (item 21) — thresholds nomeados (antes eram mágicos no painel). */
export const SIM_REALISM_OK_MIN = 0.5;
export const SIM_ERROR_RATE_PEAK_MAX = 0.05;
export const SIM_HEADROOM_TARGET_PCT = 20;

/**
 * S3a (item 15) — nome padrão de cenário sem colisão pós-delete:
 * maior índice de "Cenário N" existente + 1.
 */
export function nextScenarioName(scenarios: Array<{ name: string }>): string {
  let maxIndex = 0;
  for (const s of scenarios) {
    const m = s.name.match(/^Cenário (\d+)$/);
    if (m) maxIndex = Math.max(maxIndex, Number(m[1]));
  }
  return `Cenário ${maxIndex + 1}`;
}

/**
 * S3a (item 7/8) — guard de run stale: resposta só vale se o gráfico não
 * trocou no meio do await e a run não foi abortada. Exportado p/ teste.
 */
export function isStaleRun(capturedGraphId: string | null, currentGraphId: string | null, aborted: boolean): boolean {
  return aborted || capturedGraphId !== currentGraphId;
}

/*
 * S3a (item 19) — memo de presets em module-level: fetch 1× por sessão.
 * Ruling: api.ts não expõe erro de auth (só ApiConflictError), então 401
 * não re-invalida o cache; o usuário tem "Tentar novamente" (item 16).
 */
let presetsCache: SimulationPreset[] | null = null;
let presetsInFlight: Promise<SimulationPreset[]> | null = null;

function fetchPresetsOnce(): Promise<SimulationPreset[]> {
  if (presetsInFlight) return presetsInFlight;
  presetsInFlight = api
    .listSimulationPresets()
    .then((data) => {
      presetsCache = data;
      return data;
    })
    .catch((err: unknown) => {
      presetsInFlight = null; // falha libera o retry
      throw err;
    });
  return presetsInFlight;
}

/** Item 16 — retry manual: derruba o cache em memória e re-busca. */
export function refetchPresetsCache(): void {
  presetsCache = null;
  presetsInFlight = null;
}

export function useSimulation() {
  const graphId = useGraphStore((s) => s.graphId);
  // Item 20: seletores por length — o hook não re-renderiza a cada
  // mutação de nó; nodes/edges/context saem de getState() na hora da run.
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  const [settings, setSettings] = useState<SimSettings>(() => loadSimSettings(graphId));
  useEffect(() => {
    setSettings(loadSimSettings(graphId));
  }, [graphId]);

  const [presets, setPresets] = useState<SimulationPreset[]>(() => presetsCache ?? []);
  const [presetId, setPresetId] = useState<string>(() => presetsCache?.[0]?.id ?? "");
  const [loadingPresets, setLoadingPresets] = useState<boolean>(() => presetsCache == null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetsAttempt, setPresetsAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    // Item 16: retry manual derruba o cache e re-busca (fetchPresetsOnce
    // já resolve na hora se o cache está quente — sem flicker de loading).
    if (presetsAttempt > 0) refetchPresetsCache();
    if (!presetsCache) setLoadingPresets(true); // cache quente: sem flicker
    setPresetsError(null);
    fetchPresetsOnce()
      .then((data) => {
        if (!alive) return;
        setPresets(data);
        setPresetId((cur) => (data.some((p) => p.id === cur) ? cur : data[0]?.id ?? ""));
        setLoadingPresets(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setPresetsError(err instanceof Error ? err.message : "Falha ao carregar presets");
        setLoadingPresets(false);
      });
    return () => {
      alive = false;
    };
  }, [presetsAttempt]);

  const retryPresets = useCallback(() => {
    setPresetsAttempt((n) => n + 1);
  }, []);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  // Item 11 — hora (hh:mm) em que o resultado foi gerado, p/ o chip de seed.
  const [resultSavedAt, setResultSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Item 7: abort no unmount E na troca de gráfico; item 4: limpar
  // result/error do gráfico antigo (A sob o nome de B).
  useEffect(() => {
    controllerRef.current?.abort();
    setResult(null);
    setError(null);
    setResultSavedAt(null);
    return () => {
      controllerRef.current?.abort();
    };
  }, [graphId]);

  const setSeed = useCallback(
    (value: number) => {
      const next = clampSeed(value);
      setSettings((s) => ({ ...s, seed: next }));
      writeSimNumberSetting("seed", graphId, next);
    },
    [graphId],
  );

  const setRealism = useCallback(
    (value: number) => {
      const next = clampRealism(value);
      setSettings((s) => ({ ...s, realism: next }));
      writeSimNumberSetting("realism", graphId, next);
    },
    [graphId],
  );

  const setTestMode = useCallback(
    (mode: TestMode) => {
      setSettings((s) => ({ ...s, testMode: mode }));
      writeSimModeSetting(graphId, mode);
    },
    [graphId],
  );

  const runWith = useCallback(
    async (seedOverride?: number, options: { persistSeed?: boolean } = {}) => {
      const store = useGraphStore.getState();
      if (store.nodes.length === 0) {
        setError(SIM_EMPTY_CANVAS_MESSAGE);
        return null;
      }
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const seedUsed = seedOverride ?? settings.seed;
      // Item 7: captura o graphId da run p/ descartar resposta stale.
      const runGraphId = store.graphId;
      setRunning(true);
      setError(null);
      try {
        const data = await api.runSimulationPreset(
          {
            preset_id: presetId,
            nodes: store.nodes,
            edges: store.edges,
            context: store.context,
            seed: seedUsed,
            realism_level: settings.realism,
            test_mode: settings.testMode,
            output_format: "json",
          },
          controller.signal, // contrato (d)
        );
        if (isStaleRun(runGraphId, useGraphStore.getState().graphId, controller.signal.aborted)) {
          // Trocou de gráfico no meio (ou cancelou) — descartar sem poluir
          // o resultado do gráfico atual (item 7).
          return null;
        }
        setResult(data);
        setResultSavedAt(Date.now());
        // Item 17: seed explicitamente escolhida pelo usuário persiste SOMENTE
        // após sucesso da run.
        if (options.persistSeed) writeSimNumberSetting("seed", runGraphId, seedUsed);
        pushUiNotice({
          type: "success",
          text: `Simulação ${modeLabel(settings.testMode)} ok · capacidade ~${data.estimated_capacity_rps} RPS · realismo ${formatPct(data.realism_score, 0)}.`,
        });
        return data;
      } catch (err) {
        if (controller.signal.aborted) return null; // cancel — silencioso (item 7)
        if (isStaleRun(runGraphId, useGraphStore.getState().graphId, false)) return null;
        const base = err instanceof Error ? err.message : "Falha na simulação";
        // Contrato (d): 429 → ApiRateLimitError com .retryAfter (sem import
        // forte do symbol ainda não criado pelo S3b).
        const retryAfter =
          err && typeof err === "object" && "retryAfter" in err ? ((err as { retryAfter?: unknown }).retryAfter ?? null) : null;
        const msg =
          typeof retryAfter === "number" ? `${base} (tente novamente em ${retryAfter}s)` : base;
        setError(msg);
        pushUiNotice({ type: "error", text: msg });
        return null;
      } finally {
        if (controllerRef.current === controller) setRunning(false);
      }
    },
    [presetId, pushUiNotice, settings],
  );

  const runPreset = useCallback(() => runWith(undefined, { persistSeed: true }), [runWith]);

  const rerunSameSeed = useCallback(() => runWith(undefined, { persistSeed: true }), [runWith]);

  const newSeedAndRun = useCallback(() => {
    const next = Math.floor(Math.random() * 1_000_000);
    // Item 17 (ruling documentado): a semente aleatória é PARÂMETRO DA RUN,
    // não setting — nunca é persistida (nem em sucesso, nem em falha). A
    // setting persistida continua sendo a semente digitada pelo usuário.
    return runWith(next);
  }, [runWith]);

  // Item 15 (contrato d): roda um cenário SALVO pelo id (endpoint novo
  // POST /graphs/{id}/simulation-scenarios/{sid}/run) e atualiza o resultado.
  const runSavedScenario = useCallback(
    async (scenarioId: string) => {
      const store = useGraphStore.getState();
      const runGraphId = store.graphId;
      if (!runGraphId) return null;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setRunning(true);
      setError(null);
      try {
        const data = await api.runScenario(runGraphId, scenarioId, controller.signal);
        if (isStaleRun(runGraphId, useGraphStore.getState().graphId, controller.signal.aborted)) return null;
        setResult(data);
        setResultSavedAt(Date.now());
        pushUiNotice({ type: "success", text: "Cenário salvo executado." });
        return data;
      } catch (err) {
        if (controller.signal.aborted) return null;
        if (isStaleRun(runGraphId, useGraphStore.getState().graphId, false)) return null;
        const msg = err instanceof Error ? err.message : "Falha ao executar cenário";
        setError(msg);
        pushUiNotice({ type: "error", text: msg });
        return null;
      } finally {
        if (controllerRef.current === controller) setRunning(false);
      }
    },
    [pushUiNotice],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return {
    presets,
    presetId,
    setPresetId,
    loadingPresets,
    presetsError,
    retryPresets,
    seed: settings.seed,
    setSeed,
    realism: settings.realism,
    setRealism,
    testMode: settings.testMode,
    setTestMode,
    running,
    result,
    resultSavedAt,
    error,
    runPreset,
    rerunSameSeed,
    newSeedAndRun,
    runSavedScenario,
    cancel,
    canRun: nodeCount > 0,
  };
}
