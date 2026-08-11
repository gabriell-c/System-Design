"use client";

import {
  BookMarked,
  ClipboardList,
  FileText,
  History,
  ListChecks,
  MoreHorizontal,
  Settings2,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdrPanel from "./AdrPanel";
import AnalysisPanel from "./AnalysisPanel";
import ContextPanel from "./ContextPanel";
import HistoryPanel from "./HistoryPanel";
import KickoffPanel from "./KickoffPanel";
import PropertiesPanel from "./PropertiesPanel";
import ReviewPanel from "./ReviewPanel";
import SettingsPanel from "./SettingsPanel";
import SimulationPanel from "./SimulationPanel";

const PRIMARY = [
  { id: "context", label: "Contexto", icon: FileText },
  { id: "kickoff", label: "Kickoff", icon: ListChecks },
  { id: "props", label: "Props", icon: Wrench },
  { id: "analysis", label: "Análise", icon: Sparkles },
  { id: "sim", label: "Simulação", icon: Zap },
] as const;

const MORE = [
  { id: "adr", label: "ADRs", icon: BookMarked },
  { id: "review", label: "Revisão humana", icon: ClipboardList },
  { id: "history", label: "Histórico", icon: History },
  { id: "settings", label: "Configuração de IA", icon: Settings2 },
] as const;

type TabId = (typeof PRIMARY)[number]["id"] | (typeof MORE)[number]["id"];

export default function Inspector() {
  const [tab, setTab] = useState<TabId>("context");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = MORE.some((m) => m.id === tab);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  return (
    <aside className="flex h-full w-full flex-col border-l border-white/8 bg-[#0d1219]" aria-label="Inspetor">
      <div className="flex flex-wrap border-b border-white/8" role="tablist" aria-label="Painéis do inspetor">
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              title={item.label}
              className={`flex min-w-[52px] flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[9px] font-medium tracking-wide ${
                tab === item.id ? "border-b-2 border-cyan-400 text-cyan-200" : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={13} />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </button>
          );
        })}
        <div className="relative shrink-0" ref={moreRef}>
          <button
            type="button"
            role="tab"
            aria-selected={moreActive}
            aria-expanded={moreOpen}
            title="Mais painéis"
            className={`flex h-full min-w-[48px] flex-col items-center justify-center gap-0.5 px-2 text-[9px] font-medium ${
              moreActive ? "border-b-2 border-cyan-400 text-cyan-200" : "text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreHorizontal size={13} />
            Mais
          </button>
          {moreOpen && (
            <div className="absolute right-1 top-full z-40 mt-1 w-52 rounded-xl border border-white/10 bg-[#121821] p-1 shadow-2xl">
              {MORE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      tab === item.id ? "bg-cyan-500/15 text-cyan-200" : "text-slate-200 hover:bg-white/5"
                    }`}
                    onClick={() => {
                      setTab(item.id);
                      setMoreOpen(false);
                    }}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(tab === "analysis" || tab === "sim") && (
        <div className="border-b border-white/8 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          {tab === "analysis" ? (
            <>
              <strong className="text-slate-300">Análise</strong> — a arquitetura faz sentido para contexto + NFRs?
            </>
          ) : (
            <>
              <strong className="text-slate-300">Simulação</strong> — aguenta carga, jornada e incidentes?
            </>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "context" && <ContextPanel />}
        {tab === "kickoff" && <KickoffPanel />}
        {tab === "props" && <PropertiesPanel />}
        {tab === "analysis" && <AnalysisPanel />}
        {tab === "sim" && <SimulationPanel />}
        {tab === "adr" && <AdrPanel />}
        {tab === "review" && <ReviewPanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </aside>
  );
}
