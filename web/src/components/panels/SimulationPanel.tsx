"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Dices,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  Route,
  ShieldAlert,
  Zap,
  TrendingUp,
  Clock,
  Flame,
  XCircle,
} from "lucide-react";
import PanelHeader from "@/components/ui/PanelHeader";
import CustomSelect from "@/components/ui/Select";
import {
  SIM_EMPTY_CANVAS_MESSAGE,
  SIM_ERROR_RATE_PEAK_MAX,
  SIM_HEADROOM_TARGET_PCT,
  SIM_REALISM_OK_MIN,
  formatPct,
  modeLabel,
  nextScenarioName,
  useSimulation,
} from "@/hooks/useSimulation";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { LoadPoint } from "@/lib/simulation";
import type { SimulationScenarioRecord } from "@/lib/types";

// S3a (item 21) — constantes de leitura da timeline (antes Math.max mágico).
const MIN_BAR_PCT = 4;
const MIN_TIMELINE_MAX_RPS = 1;

function severityClass(sev: string): string {
  if (sev === "critical") return "text-rose-400";
  if (sev === "warning") return "text-amber-400";
  return "text-[var(--muted-fg)]";
}

function modeIcon(mode: string) {
  if (mode === "stress") return <Flame size={14} />;
  if (mode === "soak") return <Clock size={14} />;
  return <Gauge size={14} />;
}

function modeDesc(mode: string): string {
  if (mode === "stress") return "Empurra até quebrar — acha o teto real";
  if (mode === "soak") return "Carga sustentada — testa estabilidade";
  return "Carga normal — testa capacidade sustentável";
}

export default function SimulationPanel({ onOpenResilience }: { onOpenResilience?: () => void }) {
  const {
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
    presetsError,
    retryPresets,
    running,
    result,
    resultSavedAt,
    error,
    runPreset,
    rerunSameSeed,
    newSeedAndRun,
    runSavedScenario,
    cancel,
    canRun,
  } = useSimulation();
  const graphId = useGraphStore((s) => s.graphId);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const [scenarios, setScenarios] = useState<SimulationScenarioRecord[]>([]);
  const [scenarioName, setScenarioName] = useState("");

  // S3a (item 21): seed como draft string, commit no blur/Enter com clamp.
  const [seedDraft, setSeedDraft] = useState(String(seed));
  useEffect(() => {
    setSeedDraft(String(seed));
  }, [seed]);

  function commitSeed() {
    const parsed = Number(seedDraft);
    if (seedDraft.trim() === "" || !Number.isFinite(parsed)) {
      setSeedDraft(String(seed));
      return;
    }
    setSeed(parsed); // setSeed clampa (inteiro >= 0) e persiste por grafo
  }

  // S3a (item 6): lista de cenários — guard de stale, deps sem `result`
  // (não re-listar a cada run), catch específico com notice de erro.
  useEffect(() => {
    setScenarios([]); // troca de grafo: não deixa a lista do gráfico A
    if (!graphId) return;
    let alive = true;
    const when = graphId;
    api
      .listSimulationScenarios(when)
      .then((rows) => {
        if (!alive) return;
        if (useGraphStore.getState().graphId !== when) return; // stale — descartar
        setScenarios(rows);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (useGraphStore.getState().graphId !== when) return;
        setScenarios([]);
        pushUiNotice({
          type: "error",
          text: `Falha ao carregar cenários: ${err instanceof Error ? err.message : "erro desconhecido"}`,
        });
      });
    return () => {
      alive = false;
    };
  }, [graphId, pushUiNotice]);

  async function saveScenario() {
    if (!graphId || !result) return;
    try {
      const row = await api.createSimulationScenario(graphId, {
        // Item 15: nome padrão = maior índice existente + 1 (sem colisão pós-delete).
        name: scenarioName.trim() || nextScenarioName(scenarios),
        // Registra o seed que PRODUZIU o resultado (honesto p/ reprovar).
        payload: { presetId, seed: result.seed, realism, testMode, result_summary: result.summary },
      });
      setScenarios((prev) => [row, ...prev]);
      setScenarioName("");
      pushUiNotice({ type: "success", text: "Cenário salvo." });
    } catch (err) {
      // Item 9: sem rejection silenciosa — a lista continua em sync.
      pushUiNotice({
        type: "error",
        text: `Falha ao salvar cenário: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      });
    }
  }

  async function removeScenario(id: string) {
    if (!graphId) return;
    // Item 9: delete destrutivo — confirmação pt-BR antes.
    if (!window.confirm("Excluir este cenário? Essa ação não pode ser desfeita.")) return;
    try {
      await api.deleteSimulationScenario(graphId, id);
      // Item 9: refetch da lista após o delete (estado local nunca dessincroniza).
      const rows = await api.listSimulationScenarios(graphId);
      if (useGraphStore.getState().graphId === graphId) setScenarios(rows);
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: `Falha ao excluir cenário: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      });
    }
  }

  const selected = presets.find((p) => p.id === presetId);

  if (loadingPresets) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-[var(--muted-fg)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando presets…
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={Zap}
        chipClass="bg-amber-500/15 text-amber-300"
        title="Simulação de carga"
        subtitle="Testa se a arquitetura aguenta a carga, onde estão os gargalos, e o que quebra sob pressão."
      />

      {/* Test Mode Selector — item 21: wrap em vez de grid-3 travado em ~380px */}
      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Modo de teste</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {(["load", "stress", "soak"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTestMode(mode)}
              className={`min-w-[110px] flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                testMode === mode
                  ? "border-[var(--accent)]/50 bg-indigo-400/10 text-indigo-300"
                  : "border-[var(--border)] bg-black/20 text-[var(--muted-fg)] hover:border-[var(--border-strong)] hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {modeIcon(mode)}
                {modeLabel(mode)} Test
              </div>
              <div className="mt-1 text-sm opacity-70">{modeDesc(mode)}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Cenário</label>
        <CustomSelect
          className="mt-1"
          value={presetId}
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setPresetId}
          placeholder="Carregando…"
        />
        {presetsError && presets.length === 0 && (
          <div className="mt-1 space-y-1">
            <p className="text-sm text-rose-300">{presetsError}</p>
            <button type="button" className="btn-ghost text-xs" onClick={retryPresets}>
              Tentar novamente
            </button>
          </div>
        )}
        {selected && <p className="mt-1 text-sm text-[var(--muted)]">{selected.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="sim-seed">
            Semente
          </label>
          <p className="mt-0.5 text-sm text-[var(--muted-fg)]">Mesma semente = mesmo resultado</p>
          <input
            id="sim-seed"
            type="number"
            min={0}
            step={1}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            onBlur={commitSeed}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSeed();
              if (e.key === "Escape") setSeedDraft(String(seed));
            }}
          />
        </div>
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="sim-realism">
            Realismo
          </label>
          {/* S3a (item 28): <output> associado ao range para ATs */}
          <output htmlFor="sim-realism" className="ml-1 text-sm font-medium text-slate-300">
            {formatPct(realism, 0)}
          </output>
          <p className="mt-0.5 text-sm text-[var(--muted-fg)]">Quanto de imprevisibilidade</p>
          <input
            id="sim-realism"
            type="range"
            min={0}
            max={100}
            value={Math.round(realism * 100)}
            onChange={(e) => setRealism(Number(e.target.value) / 100)}
            className="mt-3 w-full accent-cyan-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-primary flex w-full items-center justify-center gap-2"
          disabled={running || !canRun}
          onClick={() => void runPreset()}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Rodar simulação
        </button>
        {running && (
          <button type="button" className="btn-ghost flex w-full items-center justify-center gap-1.5 text-xs" onClick={cancel}>
            <XCircle size={12} />
            Cancelar
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-ghost flex items-center justify-center gap-1.5 text-xs"
            disabled={running || !canRun}
            onClick={() => void rerunSameSeed()}
            title="Mesma variação = mesmo resultado"
          >
            <RefreshCw size={12} />
            Rodar de novo
          </button>
          <button
            type="button"
            className="btn-ghost flex items-center justify-center gap-1.5 text-xs"
            disabled={running || !canRun}
            onClick={() => void newSeedAndRun()}
          >
            <Dices size={12} />
            Nova variação
          </button>
        </div>
      </div>

      {!canRun && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          {SIM_EMPTY_CANVAS_MESSAGE}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">{error}</p>
      )}

      {result && (
        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          {/* S3a (item 11) — chip de prova de seed/reprodução/hora */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full border border-[var(--border)] bg-black/25 px-2 py-0.5 font-mono text-[var(--muted-fg)]">
              seed {result.seed}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 ${
                result.reproducible
                  ? "border-emerald-400/40 text-emerald-300"
                  : "border-amber-400/40 text-amber-300"
              }`}
            >
              {result.reproducible ? "reproduzível" : "não reproduzível"}
            </span>
            {resultSavedAt != null && (
              <span className="rounded-full border border-[var(--border)] bg-black/25 px-2 py-0.5 font-mono text-[var(--muted-fg)]">
                {new Date(resultSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {result.presets_used.length > 0 && (
              <span className="rounded-full border border-[var(--border)] bg-black/25 px-2 py-0.5 text-[var(--muted-fg)]">
                {result.presets_used.join(" · ")}
              </span>
            )}
          </div>

          {/* S3a (item 27): CTA de fragmentação — sai da simulação p/ a injeção. */}
          {onOpenResilience && (
            <button type="button" className="btn-ghost w-full text-xs" onClick={onOpenResilience}>
              Ver blast radius na aba “Falha” →
            </button>
          )}

          {/* Summary */}
          <p className="text-xs leading-relaxed text-slate-300">{result.summary}</p>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Paridade com siblings (item 21): ok = capacidade cobre o pico de carga */}
            <Metric
              icon={<Gauge size={12} />}
              label="Capacidade"
              value={`${result.estimated_capacity_rps} RPS`}
              ok={!result.load || result.estimated_capacity_rps >= result.load.peak_rps}
            />
            <Metric
              icon={<Activity size={12} />}
              label="Variabilidade"
              value={formatPct(result.realism_score)}
              ok={result.realism_score >= SIM_REALISM_OK_MIN}
            />
            {result.load && (
              <>
                <Metric label="Pico RPS" value={`${result.load.peak_rps} RPS`} ok={result.load.ok} />
                <Metric
                  label="Erros no pico"
                  value={formatPct(result.load.error_rate_peak)}
                  ok={result.load.error_rate_peak < SIM_ERROR_RATE_PEAK_MAX}
                />
              </>
            )}
            {result.journey && (
              <Metric
                icon={<Route size={12} />}
                label="Chegou ao fim"
                value={formatPct(result.journey.conversion_rate)}
                ok={result.journey.ok}
              />
            )}
            {result.events && (
              <>
                <Metric
                  icon={<AlertTriangle size={12} />}
                  label="Incidentes"
                  value={String(result.events.triggered_count)}
                  ok={result.events.ok}
                />
                <Metric label="Cascata" value={String(result.events.max_cascade_fanout)} />
              </>
            )}
            {result.engineering_audit && (
              <Metric
                icon={<TrendingUp size={12} />}
                label="Margem"
                value={`${result.engineering_audit.headroom_pct}%`}
                ok={result.engineering_audit.headroom_pct > SIM_HEADROOM_TARGET_PCT}
              />
            )}
          </div>

          {/* Engineering Audit - Bottleneck Analysis */}
          {result.engineering_audit && (
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                <ShieldAlert size={12} />
                Análise de Engenharia
              </p>

              {/* Bottleneck */}
              {result.engineering_audit.bottleneck_component && (
                <div className="mb-2 rounded-md border border-rose-500/20 bg-rose-950/20 px-2.5 py-2">
                  <p className="text-sm text-rose-300">
                    <span className="font-medium">Gargalo:</span>{" "}
                    {result.engineering_audit.bottleneck_tech} (~{result.engineering_audit.bottleneck_rps} RPS)
                  </p>
                  {/* Item 25: "Margem atual" saíu daqui (duplicava o tile Margem) */}
                  <p className="mt-1 text-sm text-[var(--muted-fg)]">
                    Sistema suporta ~{result.engineering_audit.system_capacity_rps} RPS
                  </p>
                </div>
              )}

              {/* Component Capacities */}
              {result.engineering_audit.component_capacities.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-sm font-medium uppercase text-[var(--muted)]">Componentes</p>
                  <div className="space-y-1">
                    {result.engineering_audit.component_capacities.map((comp, i) => (
                      <div key={`${i}:${comp.component}`} className="flex items-center justify-between rounded-md border border-[var(--border)] bg-black/20 px-2 py-2">
                        <span className="text-sm text-slate-300">{comp.component}</span>
                        <span className="text-sm font-mono text-[var(--muted-fg)]">{comp.tech}</span>
                        <span className="text-sm font-mono text-[var(--muted)]">{comp.capacity_rps} RPS</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failure Scenarios */}
              {result.engineering_audit.failure_scenarios.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-sm font-medium uppercase text-[var(--muted)]">Riscos identificados</p>
                  <ul className="space-y-1">
                    {result.engineering_audit.failure_scenarios.map((s, i) => (
                      <li key={`${i}:${s.slice(0, 24)}`} className="text-sm leading-snug text-amber-300/90">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {result.engineering_audit.recommendations.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium uppercase text-[var(--muted)]">Recomendações</p>
                  <ul className="space-y-1">
                    {result.engineering_audit.recommendations.map((r, i) => (
                      <li key={`${i}:${r.slice(0, 24)}`} className="flex items-start gap-1.5 text-sm text-emerald-300/90">
                        <span className="mt-0.5 text-emerald-400">→</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Findings */}
          {result.findings.length > 0 && (
            <ul className="space-y-2">
              {result.findings.map((f, i) => (
                <li
                  key={`${i}:${f.slice(0, 32)}`}
                  className="rounded-lg border border-[var(--border)] bg-black/20 px-2.5 py-2 text-sm leading-relaxed text-slate-300"
                >
                  {f}
                </li>
              ))}
            </ul>
          )}

          {/*
            S3a (item 24) — ruling: seção MANTIDA (renomeada, sem o marker
            "legacy"). `load.bottlenecks` lista gargalos POR CENÁRIO de carga
            (componente + motivo + severidade), enquanto `engineering_audit`
            mostra só o gargalo de topo + capacidades — há sobreposição, mas
            não redundância total; custo se errar: se o backend de fato
            deprecou `load.bottlenecks`, a seção some sozinha (lista vazia).
          */}
          {result.load && result.load.bottlenecks.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Gargalos de carga</p>
              <ul className="space-y-1">
                {result.load.bottlenecks.map((b, i) => (
                  <li key={`${i}:${b.component}`} className="text-sm leading-snug">
                    <span className={`font-medium ${severityClass(b.severity)}`}>{b.component}</span>
                    <span className="text-[var(--muted)]"> — {b.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Journey */}
          {result.journey && (
            <div>
              <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Jornada do usuário</p>
              <ul className="space-y-1">
                {result.journey.steps.map((s) => (
                  <li key={s.step_id} className="flex items-center justify-between gap-2 text-sm text-slate-300">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 font-mono text-[var(--muted)]">
                      {s.completed}/{s.entered} · {formatPct(s.success_rate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Events */}
          {result.events && result.events.events.some((e) => e.triggered) && (
            <div>
              <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Incidentes</p>
              <ul className="space-y-2">
                {result.events.events
                  .filter((e) => e.triggered)
                  .map((e) => (
                    <li key={e.event_type} className="text-sm leading-snug">
                      <span className={`font-medium ${severityClass(e.severity)}`}>{e.event_type}</span>
                      <span className="text-[var(--muted)]"> — {e.impact}</span>
                      {e.cascade.length > 0 && (
                        <span className="block text-[var(--muted-fg)]">cascata: {e.cascade.join(" → ")}</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Validations */}
          {result.validations.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                <CheckCircle2 size={11} />
                Validações
              </p>
              <ul className="space-y-1">
                {result.validations.map((v) => (
                  <li key={v.metric} className="flex justify-between text-sm">
                    <span className="text-[var(--muted-fg)]">{v.metric}</span>
                    <span className={v.passed ? "text-emerald-300" : "text-rose-300"}>
                      {v.actual ?? "—"} {v.passed ? "ok" : "fail"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          {result.load && result.load.timeline.length > 0 ? (
            <MiniTimeline points={result.load.timeline} capacity={result.estimated_capacity_rps} />
          ) : result.load ? (
            /* Item 21: timeline sumia sem explicação — linha p/ preset sem curva */
            <p className="text-sm text-[var(--muted-fg)]">Este preset não tem curva de carga.</p>
          ) : null}

          {graphId && (
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Cenários salvos</p>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-xs text-slate-100"
                  placeholder="Nome do cenário"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                />
                <button type="button" className="btn-ghost text-xs" onClick={() => void saveScenario()}>
                  Salvar
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted-fg)]">
                {scenarios.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-[var(--muted)] hover:text-slate-200 disabled:opacity-40"
                        disabled={running}
                        onClick={() => void runSavedScenario(s.id)}
                      >
                        Rodar
                      </button>
                      <button
                        type="button"
                        className="text-rose-300"
                        aria-label={`Excluir ${s.name}`}
                        onClick={() => void removeScenario(s.id)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  ok,
  icon,
}: {
  label: string;
  value: string;
  ok?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/25 px-2.5 py-2">
      <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-sm ${ok === false ? "text-rose-300" : ok ? "text-emerald-300" : "text-slate-100"}`}>
        {value}
      </p>
    </div>
  );
}

function MiniTimeline({
  points,
  capacity,
}: {
  points: LoadPoint[];
  capacity: number;
}) {
  const max = Math.max(capacity, ...points.map((p) => p.rps), MIN_TIMELINE_MAX_RPS);
  const capacityPct = Math.min(100, (capacity / max) * 100);
  const saturated = points.filter((p) => p.saturated);
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Timeline RPS</p>
      <div className="flex h-16 items-end gap-px rounded-lg border border-[var(--border)] bg-black/30 px-1 py-1">
        <div className="relative h-full w-full">
          <div className="flex h-full items-end gap-px">
            {points.map((p) => (
              <div
                key={`${p.t_seconds}:${p.rps}`}
                title={`t=${p.t_seconds}s · ${p.rps} RPS`}
                className={`min-w-0 flex-1 rounded-sm ${p.saturated ? "bg-rose-400/80" : "bg-indigo-400/70"}`}
                style={{ height: `${Math.max(MIN_BAR_PCT, (p.rps / max) * 100)}%` }}
              />
            ))}
          </div>
          {/* S3a (item 10): a linha de capacidade era só copy — agora é desenhada */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-dashed border-amber-400/90"
            style={{ height: `${capacityPct}%` }}
            title={`Linha de capacidade ~${capacity} RPS`}
            aria-hidden
          />
        </div>
      </div>
      {/* S3a (item 28): resumo visível para leitores de tela (só <title> não chega) */}
      <p className="sr-only">
        {`Curva de carga com ${points.length} pontos; ${saturated.length} passos saturados${
          saturated.length > 0 ? ` (t=${saturated.map((p) => `${p.t_seconds}s`).join(", ")})` : ""
        }; capacidade estimada ~${capacity} RPS.`}
      </p>
      <p className="mt-1 text-sm text-[var(--muted-fg)]">linha de capacidade ~{capacity} RPS · vermelho = saturado</p>
    </div>
  );
}
