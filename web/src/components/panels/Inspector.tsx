"use client";

import {
  BookMarked,
  ClipboardList,
  DollarSign,
  FileText,
  GitDiff,
  History,
  Layers,
  Link2,
  ListChecks,
  MoreHorizontal,
  Settings2,
  Shield,
  Skull,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "@/lib/graph-store";
import AdrPanel from "./AdrPanel";
import AnalysisPanel from "./AnalysisPanel";
import ArchitecturePanel from "./ArchitecturePanel";
import AuditTrailPanel from "./AuditTrailPanel";
import ContextPanel from "./ContextPanel";
import HistoryPanel from "./HistoryPanel";
import KickoffPanel from "./KickoffPanel";
import PropertiesPanel from "./PropertiesPanel";
import ReviewPanel from "./ReviewPanel";
import SettingsPanel from "./SettingsPanel";
import SimulationPanel from "./SimulationPanel";
import DataArchitecturePanel from "./DataArchitecturePanel";
import EventCatalogPanel from "./EventCatalogPanel";
import PolyglotMapPanel from "./PolyglotMapPanel";
import LineagePanel from "./LineagePanel";
import ThreatAnalysisPanel from "./ThreatAnalysisPanel";
import WellArchitectedPanel from "./WellArchitectedPanel";
import AccessPanel from "./AccessPanel";
import BoundaryPanel from "./BoundaryPanel";
import DiffPanel from "./DiffPanel";
import TogafPanel from "./TogafPanel";
import ResiliencePanel from "./ResiliencePanel";
import CostPanel from "./CostPanel";
import ConsistencyPanel from "./ConsistencyPanel";
import GovernancePanel from "./GovernancePanel";
import SloPanel from "./SloPanel";

const PRIMARY = [
  { id: "context", label: "Contexto", icon: FileText },
  { id: "kickoff", label: "Kickoff", icon: ListChecks },
  { id: "props", label: "Props", icon: Wrench },
  { id: "arch", label: "Arquitetura", icon: BookMarked },
  { id: "analysis", label: "Análise", icon: Sparkles },
  { id: "sim", label: "Simulação", icon: Zap },
  { id: "resilience", label: "Falha", icon: Skull },
  { id: "consistency", label: "Pacote", icon: Layers },
  { id: "governance", label: "Gov", icon: Shield },
  { id: "slo", label: "SLO", icon: Zap },
] as const;

const MORE = [
  { id: "data", label: "Dados", icon: BookMarked },
  { id: "events", label: "Eventos", icon: BookMarked },
  { id: "polyglot", label: "Polyglot map", icon: BookMarked },
  { id: "lineage", label: "Lineage", icon: BookMarked },
  { id: "threats", label: "Threats", icon: BookMarked },
  { id: "wellarch", label: "Well-Architected", icon: BookMarked },
  { id: "cost", label: "Custos", icon: DollarSign },
  { id: "wiki", label: "Wiki", icon: FileText },
  { id: "audit", label: "Audit Trail", icon: BookMarked },
  { id: "adr", label: "ADRs", icon: BookMarked },
  { id: "review", label: "Revisão humana", icon: ClipboardList },
  { id: "history", label: "Histórico", icon: History },
  { id: "settings", label: "Configuração de IA", icon: Settings2 },
  { id: "access", label: "Acesso", icon: Shield },
  { id: "boundary", label: "Borda", icon: Link2 },
  { id: "diff", label: "Diff", icon: GitDiff },
  { id: "togaf", label: "TOGAF", icon: Layers },
] as const;

type TabId = (typeof PRIMARY)[number]["id"] | (typeof MORE)[number]["id"];

export default function Inspector() {
  const graphId = useGraphStore((s) => s.graphId);
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
        {tab === "arch" && <ArchitecturePanel />}
        {tab === "analysis" && <AnalysisPanel />}
        {tab === "sim" && <SimulationPanel />}
        {tab === "resilience" && <ResiliencePanel />}
        {tab === "consistency" && <ConsistencyPanel />}
        {tab === "governance" && <GovernancePanel />}
        {tab === "slo" && <SloPanel />}
        {tab === "data" && <DataArchitecturePanel />}
        {tab === "events" && <EventCatalogPanel />}
        {tab === "polyglot" && <PolyglotMapPanel />}
        {tab === "lineage" && <LineagePanel />}
        {tab === "threats" && <ThreatAnalysisPanel />}
        {tab === "wellarch" && <WellArchitectedPanel />}
        {tab === "cost" && <CostPanel />}
        {tab === "wiki" && <WikiPanel />}
        {tab === "audit" && <AuditTrailPanel />}
        {tab === "access" && <AccessPanel graphId={graphId} />}
        {tab === "boundary" && <BoundaryPanel graphId={graphId} />}
        {tab === "diff" && <DiffPanel graphId={graphId} />}
        {tab === "togaf" && <TogafPanel />}
        {tab === "adr" && <AdrPanel />}
        {tab === "review" && <ReviewPanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </aside>
  );
}
