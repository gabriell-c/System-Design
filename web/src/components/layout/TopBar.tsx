"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CloudOff,
  Ellipsis,
  FilePlus2,
  FolderOpen,
  GitCompareArrows,
  LayoutGrid,
  Lock,
  LockOpen,
  LogOut,
  Maximize2,
  Redo2,
  Route,
  Save,
  Sparkles,
  Share2,
  Trash2,
  Undo2,
  Upload,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ExportMenu from "@/components/layout/ExportMenu";
import ThemeToggle from "@/components/ui/ThemeToggle";
import CustomSelect from "@/components/ui/Select";
import Tooltip from "@/components/ui/Tooltip";
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
  hideAnalysis?: boolean;
};

export default function TopBar({ onAnalyze, onToggleFocus, focusMode, hideAnalysis }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();
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
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const past = useGraphStore((s) => s.past);
  const future = useGraphStore((s) => s.future);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const architectureView = useGraphStore((s) => s.architectureView);
  const setArchitectureView = useGraphStore((s) => s.setArchitectureView);
  const ownerTeam = useGraphStore((s) => s.ownerTeam);
  const diagramKind = useGraphStore((s) => s.diagramKind);
  const parentGraphId = useGraphStore((s) => s.parentGraphId);
  const c4ParentNodeId = useGraphStore((s) => s.c4ParentNodeId);
  const applyAutoLayout = useGraphStore((s) => s.applyAutoLayout);
  const highlightCriticalPath = useGraphStore((s) => s.highlightCriticalPath);
  const setSequenceMode = useGraphStore((s) => s.setSequenceMode);
  const sequenceMode = useGraphStore((s) => s.sequenceMode);
  const isLocked = useGraphStore((s) => s.isLocked);
  const setIsLocked = useGraphStore((s) => s.setIsLocked);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "error" | "offline">("synced");

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void import("@/hooks/useAutoSave").then(({ subscribeSyncStatus }) => {
      unsub = subscribeSyncStatus(setSyncStatus);
    });
    return () => unsub?.();
  }, []);

  async function save() {
    try {
      const payload = {
        name,
        context,
        nfr,
        nodes,
        edges,
        owner_team: ownerTeam || null,
        diagram_kind: diagramKind,
        parent_graph_id: parentGraphId,
        c4_parent_node_id: c4ParentNodeId,
      };
      const saved = graphId ? await api.updateGraph(graphId, payload) : await api.createGraph(payload);
      markSaved(saved.id);
      pushUiNotice({ type: "success", text: "Arquitetura salva." });
    } catch (err) {
      pushUiNotice({
        type: "error",
        text:
          err instanceof Error
            ? `${err.message}. Verifique a conexão e tente novamente.`
            : "Falha ao salvar o projeto. Verifique a conexão e tente novamente.",
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
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-1)]/95 px-3 backdrop-blur">
        <nav className="mr-1 hidden shrink-0 items-center gap-1.5 text-sm sm:flex" aria-label="Breadcrumb">
          <Link href="/" className="font-semibold tracking-tight text-[var(--foreground)]" title="Voltar aos projetos">
            Archia
          </Link>
          <span className="text-[var(--muted-fg)]">/</span>
          <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Projetos
          </Link>
          <span className="text-[var(--muted-fg)]">/</span>
          <span className="max-w-[140px] truncate font-medium text-[var(--foreground)]" title={name || "Diagrama"}>
            {name?.trim() || "Diagrama"}
          </span>
        </nav>
        <Link
          href="/"
          className="mr-1 shrink-0 text-sm font-semibold tracking-tight text-[var(--foreground)] sm:hidden"
          title="Voltar aos projetos"
        >
          Archia
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor="topbar-graph-name" className="sr-only">
            Nome do diagrama
          </label>
          <input
            id="topbar-graph-name"
            aria-label="Nome da arquitetura"
            className="min-w-[120px] max-w-[220px] w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do desenho"
          />
        </div>
        <Tooltip content={dirty ? "Alterações pendentes" : "Tudo salvo"}>
          <span
            className={`hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] font-medium sm:inline-flex ${
              dirty
                ? "border-amber-500/40 bg-amber-500/20 text-amber-100"
                : "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
            }`}
          >
            {dirty ? (
              <>
                <CloudOff className="h-3.5 w-3.5" />
                não salvo
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                salvo
              </>
            )}
          </span>
        </Tooltip>
        {!isOnline || syncStatus === "offline" || syncStatus === "error" ? (
          <Tooltip
            content={
              !isOnline || syncStatus === "offline"
                ? "Offline — rascunho salvo localmente"
                : "Falha ao sincronizar com o servidor"
            }
          >
            <span className="hidden items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[12px] font-medium text-rose-100 sm:inline-flex">
              <CloudOff className="h-3.5 w-3.5" />
              {!isOnline || syncStatus === "offline" ? "offline" : "sync erro"}
            </span>
          </Tooltip>
        ) : syncStatus === "saving" ? (
          <span className="hidden text-[12px] text-[var(--muted)] sm:inline">salvando…</span>
        ) : null}

        <div className="mx-0.5 hidden h-6 w-px bg-[var(--border-strong)] sm:block" />

        <div className="flex items-center gap-2" aria-label="Desfazer e refazer">
          <Tooltip content="Desfazer">
            <button
              type="button"
              className="btn-ghost px-2"
              disabled={past.length === 0}
              onClick={() => undo()}
              aria-label="Desfazer"
            >
              <Undo2 size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Refazer">
            <button
              type="button"
              className="btn-ghost px-2"
              disabled={future.length === 0}
              onClick={() => redo()}
              aria-label="Refazer"
            >
              <Redo2 size={15} />
            </button>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip content={isLocked ? "Desbloquear canvas" : "Bloquear canvas"}>
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5"
              aria-pressed={isLocked}
              aria-label={isLocked ? "Desbloquear" : "Bloquear"}
              onClick={() => setIsLocked(!isLocked)}
            >
              {isLocked ? <Lock size={15} /> : <LockOpen size={15} />}
              <span className="hidden md:inline">{isLocked ? "Bloqueado" : "Desbloquear"}</span>
            </button>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {onToggleFocus && (
            <Tooltip content="Tela cheia (F)">
              <button
                type="button"
                className="btn-ghost inline-flex items-center gap-1.5"
                onClick={onToggleFocus}
                aria-pressed={focusMode}
                aria-label="Tela cheia"
              >
                <Maximize2 size={15} />
                <span className="hidden md:inline">Tela cheia</span>
              </button>
            </Tooltip>
          )}
          <ExportMenu />
          <Tooltip content="Salvar projeto agora">
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5"
              onClick={() => void save()}
              aria-label="Salvar projeto"
            >
              <Save size={15} />
              <span className="hidden md:inline">Salvar projeto</span>
            </button>
          </Tooltip>
          <Tooltip content={nodes.length === 0 ? "Adicione blocos antes" : "Analisar arquitetura"}>
            {!hideAnalysis && (
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={onAnalyze}
                disabled={analyzing || nodes.length === 0}
              >
                <Sparkles size={15} />
                {analyzing ? "Analisando…" : "Analisar arquitetura"}
              </button>
            )}
          </Tooltip>

          <div className="ml-2 flex items-center gap-1.5">
            <Tooltip content="Meu perfil">
              <Link
                href="/profile"
                className="hidden items-center gap-2 rounded-lg px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-[var(--foreground)] md:inline-flex"
              >
                <UserRound className="h-3.5 w-3.5" />
                {user?.username ?? "User"}
              </Link>
            </Tooltip>
            {user?.role === "senior" && (
              <Link
                href="/admin/users"
                className="hidden text-xs text-violet-300 transition-colors hover:text-violet-200 md:inline"
              >
                Admin
              </Link>
            )}
            <Tooltip content="Sair da conta">
              <button
                type="button"
                className="btn-ghost inline-flex items-center gap-2 px-2 text-xs text-[var(--muted)] hover:text-rose-300"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                aria-label="Sair da conta"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Sair da conta</span>
              </button>
            </Tooltip>
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
                className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1 elev-4"
              >
                <div className="border-b border-[var(--border)] px-2 py-2">
                  {!hideAnalysis && (
                    <>
                      <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Vista</p>
                      <div className="flex flex-wrap gap-2">
                        {ARCHITECTURE_VIEWS.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            className={`rounded-md px-2 py-1 text-[12px] font-semibold uppercase ${
                              architectureView === v.id
                                ? "bg-[var(--accent-muted)] text-indigo-200"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                            onClick={() => setArchitectureView(v.id as ArchitectureView)}
                          >
                            {v.short}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="border-b border-[var(--border)] px-2 py-2">
                  <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Tema</p>
                  <ThemeToggle />
                </div>
                <div className="border-b border-[var(--border)] px-2 py-2">
                  <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Perfil de revisão</p>
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
                  icon={<LayoutGrid size={14} />}
                  label="Organizar por zonas"
                  disabled={nodes.length === 0}
                  onClick={() => {
                    applyAutoLayout();
                    setMoreOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Route size={14} />}
                  label="Destacar caminho crítico"
                  disabled={edges.length === 0}
                  onClick={() => {
                    highlightCriticalPath();
                    setMoreOpen(false);
                  }}
                />
                <MenuItem
                  icon={<GitCompareArrows size={14} />}
                  label={sequenceMode ? "Sair modo sequência" : "Modo sequência"}
                  onClick={() => {
                    setSequenceMode(!sequenceMode);
                    setMoreOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Share2 size={14} />}
                  label="Link somente leitura"
                  disabled={!graphId}
                  onClick={() => {
                    setMoreOpen(false);
                    void (async () => {
                      if (!graphId) return;
                      try {
                        const share = await api.createGraphShare(graphId);
                        const url = `${window.location.origin}${share.share_url}`;
                        await navigator.clipboard.writeText(url);
                        pushUiNotice({ type: "success", text: "Link de compartilhamento copiado." });
                      } catch (err) {
                        pushUiNotice({
                          type: "error",
                          text: err instanceof Error ? err.message : "Falha ao gerar link",
                        });
                      }
                    })();
                  }}
                />
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
                  disabled={!selectedNodeId && selectedNodeIds.length === 0}
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
              const parsed = await parseImportPayload(JSON.parse(await file.text()));
              loadSnapshot(parsed.name, parsed.nodes, parsed.edges, parsed.analysis, parsed.context, parsed.nfr);
              pushUiNotice({ type: "success", text: "Arquitetura importada." });
            } catch (err) {
              pushUiNotice({
                type: "error",
                text:
                  err instanceof Error
                    ? `${err.message}. Verifique se o arquivo é um JSON exportado pelo Archia.`
                    : "JSON inválido. Use um arquivo exportado pelo Archia e tente novamente.",
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
