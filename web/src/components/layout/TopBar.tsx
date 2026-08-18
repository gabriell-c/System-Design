"use client";

import Link from "next/link";
import {
  Ellipsis,
  FilePlus2,
  FolderOpen,
  GitCompareArrows,
  Maximize2,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ExportMenu from "@/components/layout/ExportMenu";
import CustomSelect from "@/components/ui/Select";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { api } from "@/lib/api";
import { parseImportPayload } from "@/lib/export";
import { useAuthStore } from "@/lib/auth-store";
import { useGraphStore } from "@/lib/graph-store";
import { ARCHITECTURE_VIEWS, type ArchitectureView } from "@/lib/architecture-view";

type Props = {
  onAnalyze: () => void;
  onToggleFocus?: () => void;
  focusMode?: boolean;
};

export default function TopBar({ onAnalyze, onToggleFocus, focusMode }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const name = useGraphStore((s) => s.name);
  const setName = useGraphStore((s) => s.setName);
  const context = useGraphStore((s) => s.context);
  const nfr = useGraphStore((s) => s.nfr);
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const dirty = useGraphStore((s) => s.dirty);
  const analyzing = useGraphStore((s) => s.analyzing);
  const userRole = useGraphStore((s) => s.userRole);
  const setUserRole = useGraphStore((s) => s.setUserRole);
  const markSaved = useGraphStore((s) => s.markSaved);
  const loadSnapshot = useGraphStore((s) => s.loadSnapshot);
  const reset = useGraphStore((s) => s.reset);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const past = useGraphStore((s) => s.past);
  const future = useGraphStore((s) => s.future);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const architectureView = useGraphStore((s) => s.architectureView);
  const setArchitectureView = useGraphStore((s) => s.setArchitectureView);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  async function save() {
    try {
      const payload = { name, context, nfr, nodes, edges };
      const saved = graphId ? await api.updateGraph(graphId, payload) : await api.createGraph(payload);
      markSaved(saved.id);
      pushUiNotice({ type: "success", text: "Arquitetura salva." });
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha ao salvar",
      });
    }
  }

  async function handleNew() {
    const ok = await confirm({
      title: "Começar do zero?",
      description: "Isso limpa o canvas atual e cria um desenho em branco.",
      consequences: dirty
        ? "Há alterações não salvas. Elas serão perdidas se você não exportar ou salvar antes."
        : "O desenho atual será descartado da tela (versões já salvas no servidor permanecem).",
      confirmLabel: "Novo desenho",
      tone: "danger",
    });
    if (ok) {
      reset();
      pushUiNotice({ type: "info", text: "Canvas limpo — descreva o contexto e arraste um bloco." });
    }
  }

  async function handleDelete() {
    if (!selectedNodeId) return;
    const ok = await confirm({
      title: "Remover seleção?",
      description: "O bloco ou card selecionado será removido do canvas.",
      consequences: "Você pode desfazer com Ctrl+Z em seguida.",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (ok) deleteSelected();
  }

  return (
    <>
      {dialog}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/8 bg-[#0b1017] px-3">
        <Link href="/" className="mr-1 shrink-0 text-sm font-semibold tracking-tight text-slate-100">
          Archia
        </Link>
        <input
          aria-label="Nome da arquitetura"
          className="min-w-[120px] max-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#121821] px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do desenho"
        />
        <span
          className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${
            dirty ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"
          }`}
        >
          {dirty ? "não salvo" : "salvo"}
        </span>

        <div className="mx-0.5 hidden h-6 w-px bg-white/10 sm:block" />

        <div
          className="hidden items-center gap-0.5 rounded-lg border border-white/10 bg-[#121821] p-0.5 lg:flex"
          role="group"
          aria-label="Vista de arquitetura"
          title="Alternar vistas AN/AD/AA/AI"
        >
          {ARCHITECTURE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                architectureView === v.id
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-500 hover:text-slate-200"
              }`}
              aria-pressed={architectureView === v.id}
              onClick={() => setArchitectureView(v.id as ArchitectureView)}
              title={v.label}
            >
              {v.short}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5" aria-label="Desfazer e refazer">
          <button
            type="button"
            className="btn-ghost px-2"
            title="Desfazer (Ctrl+Z)"
            disabled={past.length === 0}
            onClick={() => undo()}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="btn-ghost px-2"
            title="Refazer (Shift+Z)"
            disabled={future.length === 0}
            onClick={() => redo()}
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {onToggleFocus && (
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5"
              onClick={onToggleFocus}
              title="Tela cheia do canvas (F) — esconde barras laterais e topo"
              aria-pressed={focusMode}
            >
              <Maximize2 size={14} />
              <span className="hidden md:inline">Tela cheia</span>
            </button>
          )}
          <ExportMenu />
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={() => void save()}>
            <Save size={14} />
            <span className="hidden md:inline">Salvar</span>
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={onAnalyze}
            disabled={analyzing || nodes.length === 0}
            title={nodes.length === 0 ? "Adicione blocos/cards antes" : "Avaliar se a arquitetura faz sentido"}
          >
            <Sparkles size={14} />
            {analyzing ? "Analisando…" : "Analisar"}
          </button>

          <div className="ml-2 flex items-center gap-2">
            <Link href="/profile" className="text-xs text-slate-400 hover:text-white transition-colors hidden md:inline">
              {user?.username ?? "User"}
            </Link>
            {user?.role === "senior" && (
              <Link href="/admin/users" className="text-xs text-purple-400 hover:text-purple-300 transition-colors hidden md:inline">
                Admin
              </Link>
            )}
            <button
              type="button"
              className="btn-ghost px-2 text-xs text-slate-400 hover:text-red-400"
              onClick={() => { logout(); window.location.href = "/login"; }}
              title="Logout"
            >
              Sair
            </button>
          </div>

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <Ellipsis size={14} />
              <span className="hidden md:inline">Mais</span>
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-white/10 bg-[#121821] p-1 shadow-2xl"
              >
                <div className="border-b border-white/8 px-2 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Perfil de revisão</p>
                  <CustomSelect
                    value={userRole}
                    options={[
                      { value: "senior", label: "Dev sênior" },
                      { value: "other", label: "Outro perfil" },
                    ]}
                    onChange={(value) => setUserRole(value === "other" ? "other" : "senior")}
                  />
                </div>
                <MenuItem
                  icon={<Upload size={14} />}
                  label="Importar JSON"
                  onClick={() => {
                    fileRef.current?.click();
                    setMoreOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Trash2 size={14} />}
                  label="Remover seleção"
                  disabled={!selectedNodeId}
                  onClick={() => {
                    setMoreOpen(false);
                    void handleDelete();
                  }}
                />
                <MenuItem
                  icon={<FolderOpen size={14} />}
                  label="Arquiteturas salvas"
                  href="/graphs"
                  onClick={() => setMoreOpen(false)}
                />
                <MenuItem
                  icon={<GitCompareArrows size={14} />}
                  label="Comparar desenhos"
                  href="/compare"
                  onClick={() => setMoreOpen(false)}
                />
                <MenuItem
                  icon={<FilePlus2 size={14} />}
                  label="Novo desenho"
                  onClick={() => {
                    setMoreOpen(false);
                    void handleNew();
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const parsed = parseImportPayload(JSON.parse(await file.text()));
              loadSnapshot(parsed.name, parsed.nodes, parsed.edges, parsed.analysis, parsed.context, parsed.nfr);
              pushUiNotice({ type: "success", text: "Arquitetura importada." });
            } catch (err) {
              pushUiNotice({
                type: "error",
                text: err instanceof Error ? err.message : "JSON inválido",
              });
            }
          }}
        />
      </header>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className = `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-40 ${
    disabled ? "pointer-events-none opacity-40" : ""
  }`;
  if (href) {
    return (
      <Link role="menuitem" href={href} className={className} onClick={onClick}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" className={className} disabled={disabled} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
