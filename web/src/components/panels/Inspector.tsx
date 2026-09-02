"use client";

import {
  BookMarked,
  BookOpen,
  ClipboardList,
  Cloud,
  Database,
  DollarSign,
  FileDiff,
  FileText,
  Gauge,
  GitBranch,
  History,
  Layers,
  Link2,
  ListChecks,
  Network,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Workflow,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
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
import WikiPanel from "./WikiPanel";
import LayerHierarchyPanel from "./LayerHierarchyPanel";
import Tooltip from "@/components/ui/Tooltip";
import PanelEmpty from "@/components/ui/PanelEmpty";
import RichTextEditor from "@/components/ui/RichTextEditor";

type IconType = ComponentType<{ size?: number; className?: string }>;

type TabItem = {
  id: string;
  label: string;
  icon: IconType;
  hint?: string;
};

const PRIMARY: TabItem[] = [
  { id: "context", label: "Contexto", icon: FileText, hint: "Contexto e NFRs" },
  { id: "props", label: "Props", icon: Wrench, hint: "Propriedades do nó" },
  { id: "analysis", label: "Análise", icon: Sparkles, hint: "Score e findings" },
  { id: "sim", label: "Simulação", icon: Zap, hint: "Carga e falhas" },
  { id: "governance", label: "Governança", icon: Shield, hint: "Policies e RACI" },
];

const MORE: TabItem[] = [
  { id: "kickoff", label: "Kickoff", icon: ListChecks, hint: "Checklist inicial" },
  { id: "arch", label: "Arquitetura", icon: BookMarked, hint: "Vistas e padrões" },
  { id: "resilience", label: "Falha", icon: Skull, hint: "Injeção de falha" },
  { id: "consistency", label: "Pacote", icon: Layers, hint: "Consistência cross-view" },
  { id: "slo", label: "SLO", icon: Gauge, hint: "SLI / error budget" },
  { id: "cost", label: "Custos", icon: DollarSign, hint: "Estimativa mensal" },
  { id: "review", label: "Revisão", icon: ClipboardList, hint: "Revisão humana" },
  { id: "adr", label: "ADRs", icon: BookOpen, hint: "Decisões" },
  { id: "history", label: "Histórico", icon: History, hint: "Undo / versões" },
  { id: "access", label: "Acesso", icon: Shield, hint: "ACL por squad" },
  { id: "settings", label: "IA", icon: Settings2, hint: "Configuração de IA" },
  { id: "data", label: "Dados", icon: Database, hint: "Arquitetura de dados" },
  { id: "events", label: "Eventos", icon: Workflow, hint: "Catálogo de eventos" },
  { id: "polyglot", label: "Polyglot", icon: Network, hint: "Polyglot map" },
  { id: "lineage", label: "Lineage", icon: GitBranch, hint: "Linha de dados" },
  { id: "threats", label: "Threats", icon: ShieldAlert, hint: "STRIDE / LINDDUN" },
  { id: "wellarch", label: "Well-Arch", icon: Cloud, hint: "Well-Architected" },
  { id: "wiki", label: "Wiki", icon: FileText, hint: "Doc viva" },
  { id: "audit", label: "Audit", icon: BookMarked, hint: "Audit trail" },
  { id: "diff", label: "Diff", icon: FileDiff, hint: "Comparar versões" },
  { id: "boundary", label: "Borda", icon: Link2, hint: "Contratos de borda" },
  { id: "togaf", label: "TOGAF", icon: Layers, hint: "Cobertura ADM" },
];

const ALL_TABS = [...PRIMARY, ...MORE];
type TabId = (typeof ALL_TABS)[number]["id"];

const HINTS: Record<string, string> = {
  analysis: "A arquitetura faz sentido para contexto + NFRs?",
  sim: "Aguenta carga, jornada e incidentes?",
};

export default function Inspector({
  hideAnalysis = false,
  onClose,
}: {
  hideAnalysis?: boolean;
  onClose?: () => void;
}) {
  const graphId = useGraphStore((s) => s.graphId);
  const [tab, setTab] = useState<TabId>("context");
  const [showMore, setShowMore] = useState(false);
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const primaryTabs = useMemo(
    () => (hideAnalysis ? PRIMARY.filter((item) => item.id !== "analysis") : PRIMARY),
    [hideAnalysis],
  );

  const visibleTabs = primaryTabs;

  const filteredMore = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MORE;
    return MORE.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.id.includes(q) ||
        (i.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  const activeInMore = MORE.some((m) => m.id === tab);

  function selectPrimary(id: TabId) {
    setTab(id);
    setShowMore(false);
  }

  function selectMore(id: TabId) {
    setTab(id);
    setShowMore(true);
  }

  const elements = useGraphStore((s) => s.excalidrawElements ?? []);
  const selectedId = useGraphStore((s) => s.selectedExcalidrawElementId);
  const setElements = useGraphStore((s) => s.setExcalidrawElements);

  const selectedElement = elements.find((e) => e.id === selectedId);
  const notes = selectedElement?.customData?.notes ?? "";

  const updateNotes = (html: string) => {
    if (!selectedElement) return;
    const updated = elements.map((e) =>
      e.id === selectedId ? { ...e, customData: { ...e.customData, notes: html } } : e
    );
    setElements(updated);
  };

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--surface-1)]"
      aria-label="Inspetor"
    >
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="panel-section-title">Inspetor</p>
          {(isMobile || onClose) && (
            <button
              type="button"
              className="btn-ghost inline-flex h-11 min-w-11 items-center justify-center rounded-lg"
              aria-label="Fechar inspetor"
              onClick={() => onClose?.()}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="grid gap-2 grid-cols-3" role="tablist" aria-label="Painéis principais">
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id && !showMore;
            return (
              <Tooltip key={item.id} content={item.hint ?? item.label} side="bottom">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectPrimary(item.id)}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    active
                      ? "bg-[var(--accent-muted)] text-indigo-200"
                      : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </Tooltip>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={showMore || activeInMore}
            onClick={() => setShowMore(true)}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              showMore || activeInMore
                ? "bg-[var(--accent-muted)] text-indigo-200"
                : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
            }`}
          >
            Outros
          </button>
        </div>
      </div>

      {(showMore || activeInMore) && (
        <div className="shrink-0 max-h-[38%] overflow-y-auto border-b border-[var(--border)] px-2 py-2">
          <div className="relative mb-2 px-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-fg)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar painel…"
              aria-label="Buscar painel"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] py-2.5 pr-3 pl-8 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredMore.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <Tooltip key={item.id} content={item.hint ?? item.label} side="left" className="w-full">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectMore(item.id)}
                    className={`flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      active
                        ? "bg-[var(--accent-muted)] text-indigo-200"
                        : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
          {filteredMore.length === 0 && (
            <PanelEmpty title="Nenhum painel encontrado" description="Tente outro termo de busca." />
          )}
        </div>
      )}

      {HINTS[tab] && (
        <div className="prose-measure shrink-0 border-b border-[var(--border)] bg-black/20 px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
          {HINTS[tab]}
        </div>
      )}

      <div className="panel-body min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
        {tab === "layers" && <LayerHierarchyPanel />}
        {tab === "notes" && (
          <div className="p-4">
            <RichTextEditor
              value={notes}
              onChange={updateNotes}
              placeholder="Escreva notas para o elemento selecionado…"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
