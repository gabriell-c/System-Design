"use client";

import { AlertTriangle, Loader2, Skull, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import PanelHeader from "@/components/ui/PanelHeader";
import CustomSelect from "@/components/ui/Select";
import { useGraphStore } from "@/lib/graph-store";
import { isArchData } from "@/lib/types";
import type { BlastRadiusResult, FailureInjectionResult } from "@/lib/types";
import type { FailureMode } from "@/lib/stores/types";

/**
 * S3a (item 2): MESMO raio p/ injeção e blast (antes 8 na injeção, 6 no
 * blast — 3 números inconsistentes na mesma tela). O backend usa 8.
 */
const RESILIENCE_MAX_HOPS = 8;
const RESILIENCE_HOPS_SLIDER_MIN = 1;
const RESILIENCE_HOPS_SLIDER_MAX = 20;

/** Item 22: modo persistido por grafo (constância com o item 14 da simulação). */
function resilienceModeKey(graphId: string | null): string {
  return `archia-resilience-mode-${graphId ?? "draft"}`;
}

function readStoredMode(graphId: string | null): FailureMode {
  try {
    if (typeof localStorage === "undefined") return "down";
    const v = localStorage.getItem(resilienceModeKey(graphId));
    return v === "down" || v === "timeout" || v === "degraded" ? v : "down";
  } catch {
    return "down";
  }
}

function storeMode(graphId: string | null, mode: FailureMode): void {
  try {
    localStorage.setItem(resilienceModeKey(graphId), mode);
  } catch {
    /* SSR/private mode — silencioso de propósito */
  }
}

export default function ResiliencePanel() {
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const setBlastRadiusHighlight = useGraphStore((s) => s.setBlastRadiusHighlight);
  const clearBlastRadiusHighlight = useGraphStore((s) => s.clearBlastRadiusHighlight);
  const setLastInjection = useGraphStore((s) => s.setLastInjection);
  const lastInjection = useGraphStore((s) => s.lastInjection);
  const blastUnreachableIds = useGraphStore((s) => s.blastUnreachableIds);
  const blastDegradedIds = useGraphStore((s) => s.blastDegradedIds);
  const blastEdgeIds = useGraphStore((s) => s.blastEdgeIds);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  // Item 3 (ruling): o store JÁ tem a flag — `dirty` (document-slice) e
  // `saveStatus: "dirty"` (save-slice). Hint de canvas-sujo usa os dois.
  const dirty = useGraphStore((s) => s.dirty || s.saveStatus === "dirty");

  const [mode, setMode] = useState<FailureMode>("down");
  const [maxHops, setMaxHops] = useState(RESILIENCE_MAX_HOPS);
  const [loading, setLoading] = useState(false);
  const [injection, setInjection] = useState<FailureInjectionResult | null>(null);
  const [blast, setBlast] = useState<BlastRadiusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const serviceNodes = nodes.filter((n) => isArchData(n.data));

  // Item 5: reidratar a partir do store por graphId (o painel desmonta ao
  // trocar de tab; `lastInjection` guarda origem/modo p/ "o vermelho sem origem").
  // Item 8: abort em flight + descarte do estado local ao trocar de gráfico.
  useEffect(() => {
    controllerRef.current?.abort();
    const li = useGraphStore.getState().lastInjection;
    setMode(li && li.graphId === graphId ? li.mode : readStoredMode(graphId));
    setInjection(null);
    setBlast(null);
    setError(null);
    return () => {
      controllerRef.current?.abort();
    };
  }, [graphId]);

  function changeMode(next: FailureMode) {
    setMode(next);
    storeMode(graphId, next); // item 22: persiste por grafo
  }

  const targetId = selectedNodeId;
  const targetIsService = serviceNodes.some((n) => n.id === targetId);
  const targetNode = targetId ? nodes.find((n) => n.id === targetId) : null;
  const targetLabel =
    targetNode && isArchData(targetNode.data) ? targetNode.data.label : targetId ?? "nenhum nó selecionado";

  // Item 8 (ruling documentado): guard de mounted/aborted/stale ANTES de
  // mutar o canvas. Ruling: descartar SILENCIOSAMENTE quando o componente
  // desmontou; UMA notice "resultado de outro gráfico descartado" apenas
  // quando o gráfico trocou no meio da run.
  function handleLateRun(when: string): boolean {
    const current = useGraphStore.getState().graphId;
    if (when === current) return false;
    pushUiNotice({ type: "info", text: "Resultado de outro gráfico descartado." });
    return true;
  }

  async function runInjection() {
    if (!graphId || !targetId || !targetIsService) {
      setError("Selecione um serviço no canvas.");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const when = graphId; // guard de stale (item 8)
    const nodeLabel = serviceNodes.find((n) => n.id === targetId)?.data.label ?? targetId;
    // Item 5: registra a origem no store (reidratação em troca de tab).
    setLastInjection({ graphId: when, nodeId: targetId, nodeLabel, mode });
    setLoading(true);
    setError(null);
    try {
      const result = await api.failureInjection(
        when,
        { node_id: targetId, mode, max_hops: maxHops },
        controller.signal, // contrato (d)
      );
      if (controller.signal.aborted || handleLateRun(when)) return;
      setInjection(result);
      if (!result.ok) {
        setError(result.error ?? "Falha na injeção");
        return;
      }
      const blastResult = await api.blastRadius(
        when,
        { node_id: targetId, mode, max_hops: maxHops },
        controller.signal, // contrato (d) — MESMO max_hops da injeção (item 2)
      );
      if (controller.signal.aborted || handleLateRun(when)) return;
      setBlast(blastResult);
      if (blastResult.ok) {
        // Item 5 (contrato e): produzir os rótulos dos nós NA HORA da injeção.
        const freshNodes = useGraphStore.getState().nodes;
        const labelOf = (id: string) => {
          const n = freshNodes.find((x) => x.id === id);
          // CanvasNodeData é união — nem todo member tem `label` (ex.: FreeNodeData).
          return n ? ((n.data as { label?: string }).label ?? id) : id;
        };
        const unreachable = blastResult.unreachable_node_ids ?? [];
        const degraded = blastResult.degraded_node_ids ?? [];
        setBlastRadiusHighlight({
          unreachable,
          degraded,
          edgeIds: blastResult.highlight_edge_ids ?? [],
          labels: { unreachable: unreachable.map(labelOf), degraded: degraded.map(labelOf) },
        });
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      if (handleLateRun(when)) return;
      setError(e instanceof Error ? e.message : "Erro na simulação");
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }

  function clear() {
    setInjection(null);
    setBlast(null);
    setError(null);
    // Item 13: limpa SÓ estado de blast — o highlight da Análise sobrevive.
    clearBlastRadiusHighlight();
    setLastInjection(null);
  }

  const hops = blast?.hops
    ? // Item 23: keys de hops em ordem numérica (antes: ordem de inserção)
      Object.entries(blast.hops).sort(([a], [b]) => Number(a) - Number(b))
    : [];

  const hasBlastState =
    injection !== null || blast !== null || blastUnreachableIds.length > 0 || blastDegradedIds.length > 0 || blastEdgeIds.length > 0;

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={Skull}
        chipClass="bg-rose-500/15 text-rose-300"
        title="Injeção de falha"
        subtitle="Selecione um serviço no canvas e simule indisponibilidade — blast radius no diagrama."
      />

      {/* Item 3: canvas sujo → resiliência roda sobre o banco */}
      {graphId && dirty && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Simulado sobre a versão salva — salve o diagrama para incluir edições.
        </p>
      )}

      {serviceNodes.length === 0 ? (
        /* Item 22: empty state — zero nós de serviço no canvas */
        <p className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-xs text-[var(--muted-fg)]">
          Nenhum serviço no canvas — adicione componentes.
        </p>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Modo de falha</label>
            <CustomSelect
              className="mt-1"
              value={mode}
              options={[
                { value: "down", label: "Indisponível (down)" },
                { value: "timeout", label: "Tempo estourado (timeout)" },
                { value: "degraded", label: "Degradado" },
              ]}
              onChange={(v) => changeMode(v as FailureMode)}
            />
          </div>

          <div>
            <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="resilience-hops">
              Raio da propagação: {maxHops} hops
            </label>
            <input
              id="resilience-hops"
              type="range"
              min={RESILIENCE_HOPS_SLIDER_MIN}
              max={RESILIENCE_HOPS_SLIDER_MAX}
              value={maxHops}
              onChange={(e) => setMaxHops(Number(e.target.value))}
              className="mt-1 w-full accent-rose-400"
            />
          </div>

          <p className="text-xs text-[var(--muted)]">
            Alvo:{" "}
            <strong className="text-slate-300">{targetLabel}</strong>
            {targetId && !targetIsService && (
              <span className="mt-1 block text-amber-300">O nó selecionado não é um serviço — selecione um serviço no canvas.</span>
            )}
            {!targetId && lastInjection?.graphId === graphId && (
              <span className="mt-1 block text-[var(--muted-fg)]">
                Última injeção: {lastInjection.nodeLabel} ({failureModeLabel(lastInjection.mode)})
              </span>
            )}
          </p>

          {/* Item 12: fallback dropdown de serviços quando nada está selecionado */}
          {!targetId && (
            <div>
              <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Alvo (nada selecionado)</label>
              <CustomSelect
                className="mt-1"
                value=""
                options={serviceNodes.map((n) => ({ value: n.id, label: n.data.label }))}
                onChange={(v) => v && setSelectedNodeId(v)}
                placeholder="Escolha um serviço"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5"
              disabled={loading || !graphId || !targetIsService}
              onClick={() => void runInjection()}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Injetar falha
            </button>
            <button type="button" className="btn-ghost" disabled={!hasBlastState} onClick={clear}>
              Limpar highlight
            </button>
          </div>
          {!targetIsService && !loading && (
            <p className="text-xs text-[var(--muted-fg)]">Selecione um serviço no canvas.</p>
          )}
        </>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400" role="alert">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}

      {injection?.ok && (
        <div className="rounded-lg border border-[var(--border)] bg-black/25 p-3 text-xs text-slate-300">
          <p className="font-medium text-slate-100">{injection.summary}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {/* Item 22: linhas SÓ quando o field existe (sem ?? 0 fabricando zeros) */}
            {injection.unreachable_node_ids && (
              <li>{injection.unreachable_node_ids.length} nós indisponíveis</li>
            )}
            {injection.degraded_node_ids && <li>{injection.degraded_node_ids.length} degradados</li>}
            {injection.journeys_broken_pct != null && (
              <li>{injection.journeys_broken_pct}% das jornadas quebradas</li>
            )}
            {injection.critical_path_broken != null && injection.critical_path_total != null && (
              <li>
                Caminho crítico: {injection.critical_path_broken}/{injection.critical_path_total} quebrados
              </li>
            )}
          </ul>
          {(injection.fallback_activations?.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              <p className="font-medium text-amber-200">Fallbacks ativados</p>
              {injection.fallback_activations?.map((f, i) => (
                <p key={`${i}:${f.from}:${f.to}`} className="text-[var(--muted-fg)]">
                  {f.from} → {f.to}: {f.detail}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {hops.length > 0 && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-xs">
          <p className="font-medium text-rose-200">Blast por hop</p>
          {hops.map(([hop, ids]) => (
            <p key={hop} className="mt-1 text-[var(--muted-fg)]">
              Hop {hop}: {ids.length} nó(s)
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function failureModeLabel(mode: string): string {
  if (mode === "down") return "Indisponível";
  if (mode === "timeout") return "Tempo estourado";
  if (mode === "degraded") return "Degradado";
  return mode;
}
