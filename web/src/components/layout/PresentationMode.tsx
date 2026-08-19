"use client";

import { useState } from "react";
import { Play, SkipBack, SkipForward, X } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";

interface Props {
  graphId: string;
}

/**
 * P3.1.2 — Presentation mode with spotlight.
 * Highlight nodes based on narrative step or flow number.
 */
export default function PresentationMode({ graphId }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);

  // Extract steps from edges with flowNumber
  const steps = edges
    .filter((e) => e.data?.flowNumber)
    .map((e) => ({
      id: e.id,
      flowNumber: e.data.flowNumber,
      label: e.data.label || e.id,
      source: e.source,
      target: e.target,
    }))
    .sort((a, b) => a.flowNumber - b.flowNumber);

  if (steps.length === 0) {
    return null;
  }

  const current = steps[step] ?? steps[0];
  const currentNodeId = current?.target ?? current?.source;

  // Highlight nodes in the current step and previous steps
  const highlightedNodeIds = steps
    .slice(0, step + 1)
    .map((s) => s.source)
    .concat(steps.slice(0, step + 1).map((s) => s.target))
    .filter(Boolean);

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));
  const handleNext = () => setStep((s) => Math.min(steps.length - 1, s + 1));
  const handlePlay = () => {
    setPlaying((p) => !p);
    if (!playing) {
      const interval = setInterval(() => {
        setStep((s) => {
          if (s >= steps.length - 1) {
            clearInterval(interval);
            setPlaying(false);
            return s;
          }
          return s + 1;
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-20 right-4 z-40 rounded-full bg-violet-600/80 p-2 text-white shadow-lg hover:bg-violet-500"
        onClick={() => setOpen(true)}
        title="Modo apresentação"
      >
        <Play size={16} />
      </button>
    );
  }

  return (
    <>
      {/* Spotlight overlay */}
      <div className="fixed inset-0 z-30 pointer-events-none" />

      {/* Controls */}
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/20 bg-[#0d1219]/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
            onClick={handlePrev}
            disabled={step === 0}
          >
            <SkipBack size={14} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-violet-300">
              Passo {step + 1} / {steps.length}
            </span>
            <span className="text-[10px] text-slate-500">
              {current?.label ?? steps[step]?.id}
            </span>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
            onClick={handleNext}
            disabled={step >= steps.length - 1}
          >
            <SkipForward size={14} />
          </button>
          <button
            type="button"
            className={`rounded-lg px-2 py-1 text-xs ${playing ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}
            onClick={handlePlay}
          >
            {playing ? "Pausar" : "Auto"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setOpen(false)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
