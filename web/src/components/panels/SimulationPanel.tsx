"use client";

import type { ReactNode } from "react";
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
  Zap,
} from "lucide-react";
import CustomSelect from "@/components/ui/Select";
import { useSimulation } from "@/hooks/useSimulation";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function severityClass(sev: string): string {
  if (sev === "critical") return "text-rose-300";
  if (sev === "warning") return "text-amber-300";
  return "text-slate-400";
}

export default function SimulationPanel() {
  const {
    presets,
    presetId,
    setPresetId,
    seed,
    setSeed,
    realism,
    setRealism,
    loadingPresets,
    running,
    result,
    error,
    runPreset,
    rerunSameSeed,
    newSeedAndRun,
    canRun,
  } = useSimulation();

  const selected = presets.find((p) => p.id === presetId);

  if (loadingPresets) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando cenários…
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
          <Zap size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Simulação de uso</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Testa se a arquitetura aguenta carga, quantos usuários chegam ao fim, e o que quebra sob pressão.
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cenário</label>
        <CustomSelect
          className="mt-1"
          value={presetId}
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setPresetId}
        />
        {selected && <p className="mt-1 text-[11px] text-slate-500">{selected.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="sim-seed">
            Variação
          </label>
          <p className="mt-0.5 text-[10px] text-slate-600">Número diferente = resultado diferente</p>
          <input
            id="sim-seed"
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="sim-realism">
            Ruído {(realism * 100).toFixed(0)}%
          </label>
          <p className="mt-0.5 text-[10px] text-slate-600">Quanto de imprevisibilidade na simulação</p>
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
          Adicione cards/blocos no canvas para simular.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">{error}</p>
      )}

      {result && (
        <div className="space-y-3 border-t border-white/8 pt-3">
          <p className="text-xs leading-relaxed text-slate-300">{result.summary}</p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric
              icon={<Gauge size={12} />}
              label="Capacidade"
              value={`${result.estimated_capacity_rps} RPS`}
            />
            <Metric
              icon={<Activity size={12} />}
              label="Variabilidade"
              value={pct(result.realism_score)}
              ok={result.realism_score >= 0.5}
            />
            {result.load && (
              <>
                <Metric label="Pico RPS" value={`${result.load.peak_rps} RPS`} ok={result.load.ok} />
                <Metric label="Erros no pico" value={pct(result.load.error_rate_peak)} ok={result.load.error_rate_peak < 0.05} />
              </>
            )}
            {result.journey && (
              <Metric
                icon={<Route size={12} />}
                label="Chegou ao fim"
                value={pct(result.journey.conversion_rate)}
                ok={result.journey.ok}
              />
            )}
            {result.events && (
              <Metric
                icon={<AlertTriangle size={12} />}
                label="Incidentes"
                value={`${result.events.triggered_count} · cascata ${result.events.cascade_depth}`}
                ok={result.events.ok}
              />
            )}
          </div>

          {result.findings.length > 0 && (
            <ul className="space-y-1.5">
              {result.findings.map((f) => (
                <li
                  key={f}
                  className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300"
                >
                  {f}
                </li>
              ))}
            </ul>
          )}

          {result.load && result.load.bottlenecks.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Gargalos</p>
              <ul className="space-y-1">
                {result.load.bottlenecks.map((b) => (
                  <li key={`${b.component}-${b.reason}`} className="text-[11px] leading-snug">
                    <span className={`font-medium ${severityClass(b.severity)}`}>{b.component}</span>
                    <span className="text-slate-500"> — {b.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.journey && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jornada</p>
              <ul className="space-y-1">
                {result.journey.steps.map((s) => (
                  <li key={s.step_id} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 font-mono text-slate-500">
                      {s.completed}/{s.entered} · {pct(s.success_rate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.events && result.events.events.some((e) => e.triggered) && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Incidentes</p>
              <ul className="space-y-1.5">
                {result.events.events
                  .filter((e) => e.triggered)
                  .map((e) => (
                    <li key={e.event_type} className="text-[11px] leading-snug">
                      <span className={`font-medium ${severityClass(e.severity)}`}>{e.event_type}</span>
                      <span className="text-slate-500"> — {e.impact}</span>
                      {e.cascade.length > 0 && (
                        <span className="block text-slate-600">cascata: {e.cascade.join(" → ")}</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {result.validations.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <CheckCircle2 size={11} />
                Validação
              </p>
              <ul className="space-y-1">
                {result.validations.map((v) => (
                  <li key={v.metric} className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{v.metric}</span>
                    <span className={v.passed ? "text-emerald-300" : "text-rose-300"}>
                      {v.actual ?? "—"} {v.passed ? "ok" : "fail"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.load && result.load.timeline.length > 0 && (
            <MiniTimeline points={result.load.timeline} capacity={result.estimated_capacity_rps} />
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
    <div className="rounded-lg border border-white/8 bg-black/25 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
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
  points: { t_seconds: number; rps: number; saturated: boolean }[];
  capacity: number;
}) {
  const max = Math.max(capacity, ...points.map((p) => p.rps), 1);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Timeline RPS</p>
      <div className="flex h-16 items-end gap-px rounded-lg border border-white/8 bg-black/30 px-1 py-1">
        {points.map((p) => (
          <div
            key={p.t_seconds}
            title={`t=${p.t_seconds}s · ${p.rps} RPS`}
            className={`min-w-0 flex-1 rounded-sm ${p.saturated ? "bg-rose-400/80" : "bg-cyan-400/70"}`}
            style={{ height: `${Math.max(4, (p.rps / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-600">linha de capacidade ~{capacity} RPS · vermelho = saturado</p>
    </div>
  );
}

