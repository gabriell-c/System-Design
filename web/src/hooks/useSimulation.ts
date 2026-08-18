"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { SimulationPreset, SimulationResult } from "@/lib/simulation";

const SEED_KEY = "archia-sim-seed";
const REALISM_KEY = "archia-sim-realism";
const MODE_KEY = "archia-sim-mode";

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function useSimulation() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const context = useGraphStore((s) => s.context);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  const [presets, setPresets] = useState<SimulationPreset[]>([]);
  const [presetId, setPresetId] = useState<string>("gradual-ramp");
  const [seed, setSeedState] = useState(() => readNumber(SEED_KEY, 42));
  const [realism, setRealismState] = useState(() => readNumber(REALISM_KEY, 0.65));
  const [testMode, setTestModeState] = useState<"load" | "stress" | "soak">(() => {
    try {
      const storedMode = localStorage.getItem(MODE_KEY);
      if (storedMode === "stress" || storedMode === "soak") return storedMode;
    } catch {
      /* ignore */
    }
    return "load";
  });
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listSimulationPresets()
      .then((data) => {
        if (!alive) return;
        setPresets(data);
        if (data.length && !data.some((p) => p.id === presetId)) {
          setPresetId(data[0].id);
        }
        setLoadingPresets(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar presets");
        setLoadingPresets(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez
  }, []);

  const setSeed = useCallback((value: number) => {
    const next = Math.max(0, Math.floor(value));
    setSeedState(next);
    try {
      localStorage.setItem(SEED_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setRealism = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    setRealismState(next);
    try {
      localStorage.setItem(REALISM_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setTestMode = useCallback((mode: "load" | "stress" | "soak") => {
    setTestModeState(mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const runPreset = useCallback(async () => {
    if (nodes.length === 0) {
      setError("Adicione nodes no canvas antes de simular");
      return null;
    }
    setRunning(true);
    setError(null);
    try {
      const data = await api.runSimulationPreset({
        preset_id: presetId,
        nodes,
        edges,
        context,
        seed,
        realism_level: realism,
        test_mode: testMode,
        output_format: "json",
      });
      setResult(data);
      pushUiNotice({
        type: "success",
        text: `Simulação ${modeLabel(testMode)} ok · capacidade ~${data.estimated_capacity_rps} RPS · realismo ${(data.realism_score * 100).toFixed(0)}%.`,
      });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na simulação";
      setError(msg);
      pushUiNotice({ type: "error", text: msg });
      return null;
    } finally {
      setRunning(false);
    }
  }, [context, edges, nodes, presetId, pushUiNotice, realism, seed, testMode]);

  const rerunSameSeed = useCallback(async () => {
    return runPreset();
  }, [runPreset]);

  const newSeedAndRun = useCallback(async () => {
    const next = Math.floor(Math.random() * 1_000_000);
    setSeed(next);
    // usa o valor novo no request direto
    if (nodes.length === 0) {
      setError("Adicione nodes no canvas antes de simular");
      return null;
    }
    setRunning(true);
    setError(null);
    try {
      const data = await api.runSimulationPreset({
        preset_id: presetId,
        nodes,
        edges,
        context,
        seed: next,
        realism_level: realism,
        test_mode: testMode,
        output_format: "json",
      });
      setResult(data);
      pushUiNotice({
        type: "success",
        text: `Nova semente ${next} · simulação ${modeLabel(testMode)} concluída.`,
      });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na simulação";
      setError(msg);
      pushUiNotice({ type: "error", text: msg });
      return null;
    } finally {
      setRunning(false);
    }
  }, [context, edges, nodes, presetId, pushUiNotice, realism, setSeed, testMode]);

  return {
    presets,
    presetId,
    setPresetId,
    seed,
    setSeed,
    realism,
    setRealism,
    testMode,
    setTestMode,
    loadingPresets,
    running,
    result,
    error,
    runPreset,
    rerunSameSeed,
    newSeedAndRun,
    canRun: nodes.length > 0,
  };
}

function modeLabel(mode: string): string {
  if (mode === "stress") return "Stress";
  if (mode === "soak") return "Soak";
  return "Load";
}
