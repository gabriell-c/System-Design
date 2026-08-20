"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Play, SkipBack, SkipForward, Sun, X } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";

interface Props {
  graphId: string;
}

type Theme = "dark" | "light";

/** P0.2.9 — Presentation mode: spotlight + teclas + fundo claro opcional. */
export default function PresentationMode({ graphId: _graphId }: Props) {
  const setHighlightNodeIds = useGraphStore((s) => s.setHighlightNodeIds);
  const setDiffHighlights = useGraphStore((s) => s.setDiffHighlights);
  const edges = useGraphStore((s) => s.edges);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = edges
    .filter((e) => e.data?.flowNumber != null)
    .map((e) => ({
      id: e.id,
      flowNumber: Number(e.data?.flowNumber),
      label: String(e.data?.label ?? e.id),
      source: e.source,
      target: e.target,
    }))
    .sort((a, b) => a.flowNumber - b.flowNumber);

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));
  const handleNext = () => setStep((s) => Math.min(steps.length - 1, s + 1));
  const handlePlay = () => setPlaying((v) => !v);

  // Update highlights when step changes
  useEffect(() => {
    if (steps.length === 0) {
      setHighlightNodeIds([]);
      setDiffHighlights([]);
      return;
    }

    const highlightedNodes = new Set<string>();
    const highlightedEdges = new Set<string>();

    for (let i = 0; i <= Math.min(step, steps.length - 1); i++) {
      highlightedEdges.add(steps[i].id);
      highlightedNodes.add(steps[i].source);
      highlightedNodes.add(steps[i].target);
    }

    setHighlightNodeIds(Array.from(highlightedNodes));
    setDiffHighlights(
      Array.from(highlightedEdges).map((id) => ({
        edgeId: id,
        status: "added",
      })),
    );
  }, [step, steps, setHighlightNodeIds, setDiffHighlights]);

  // Keyboard nav: ArrowLeft/Right, Space (play/pause), Escape (close)
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (e.key === " ") {
          setPlaying((v) => !v);
        } else {
          handleNext();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "t" || e.key === "T") {
        setTheme((v) => (v === "dark" ? "light" : "dark"));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, step, steps.length]);

  // Auto-play interval
  useEffect(() => {
    if (!playing || steps.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= steps.length - 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, steps.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setHighlightNodeIds([]);
      setDiffHighlights([]);
    };
  }, [setHighlightNodeIds, setDiffHighlights]);

  // Apply light background when in light theme
  useEffect(() => {
    const body = document.body;
    if (theme === "light") {
      body.classList.add("archia-presentation-light");
    } else {
      body.classList.remove("archia-presentation-light");
    }
  }, [theme]);

  const current = steps[step] ?? steps[0];

  if (steps.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-20 right-4 z-40 rounded-full bg-violet-600/80 p-2 text-white shadow-lg hover:bg-violet-500"
        onClick={() => setOpen(true)}
        title="Modo apresentação (Setas/T/Esc)"
        aria-label="Abrir modo apresentação"
      >
        <Play size={16} />
      </button>
    );
  }

  return (
    <>
      {/* Controls */}
      <div
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/20 bg-[#0d1219]/95 px-4 py-3 shadow-2xl backdrop-blur"
        role="region"
        aria-label="Controles de apresentação"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
            onClick={handlePrev}
            disabled={step === 0}
            aria-label="Passo anterior"
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
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
            onClick={handleNext}
            disabled={step >= steps.length - 1}
            aria-label="Próximo passo"
          >
            <SkipForward size={14} />
          </button>
          <button
            type="button"
            className={`rounded-lg px-2 py-1 text-xs ${playing ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}
            onClick={handlePlay}
            aria-label={playing ? "Pausar apresentação" : "Iniciar apresentação"}
          >
            {playing ? "Pausar" : "Auto"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            aria-label="Alternar tema"
            title="Tema claro/escuro (tecla T)"
          >
            {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setOpen(false)}
            aria-label="Fechar modo apresentação"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          ← → navegar · Espaço auto · T tema · Esc sair
        </p>
      </div>
    </>
  );
}
