"use client";

import NewProjectModal from "@/components/dashboard/NewProjectModal";
import ProjectCard from "@/components/dashboard/ProjectCard";
import ProjectFilters from "@/components/dashboard/ProjectFilters";
import FirstProjectWizard from "@/components/onboarding/FirstProjectWizard";
import { useProjectStore } from "@/lib/project-store";
import {
  AlertTriangle,
  Archive,
  ArchiveX,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  Layers,
  Network,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Stats = {
  total: number;
  pinned: number;
  archived: number;
  public: number;
  nodes: number;
};

export default function DashboardPage() {
  const {
    projects,
    isLoading,
    filters,
    setFilters,
    loadProjects,
    createProject,
    deleteProject,
    archiveProject,
    pinProject,
  } = useProjectStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(() => {
    // Initialize from localStorage to avoid hydration mismatch
    try {
      const onboarded = localStorage.getItem("archia-onboarded");
      return onboarded === "1";
    } catch {
      return false;
    }
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const router = useRouter();

  const refresh = useCallback(() => void loadProjects(), [loadProjects]);

  // Load projects on mount (this is a side effect, not state sync)
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({ search: searchDraft });
      void loadProjects({ search: searchDraft });
    }, 250);
    return () => clearTimeout(t);
  }, [searchDraft, setFilters, loadProjects]);

  const stats = useMemo<Stats>(() => {
    const all = projects;
    return {
      total: all.length,
      pinned: all.filter((p) => p.pinned).length,
      archived: all.filter((p) => p.archived).length,
      public: all.filter((p) => p.is_public).length,
      nodes: all.reduce((sum, p) => sum + (p.node_count ?? 0), 0),
    };
  }, [projects]);

  const shownProjects = useMemo(
    () => projects.filter((p) => (filters.archived ? p.archived : !p.archived)),
    [projects, filters.archived],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--background)]/90 px-6 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-100">Dashboard</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <FolderKanban className="h-3 w-3" />
                Gerencie seus projetos de arquitetura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow transition hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Novo projeto
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
        <div className="grid grid-cols-2 gap-3 pb-5 sm:grid-cols-4">
          <StatCard
            label="Projetos"
            value={stats.total}
            icon={<Layers className="h-4 w-4 text-indigo-400" />}
            subIcon={<Pin className="h-3 w-3" />}
            sub={`${stats.pinned} fixados`}
          />
          <StatCard
            label="Nós no total"
            value={stats.nodes}
            icon={<Network className="h-4 w-4 text-emerald-400" />}
            subIcon={<Layers className="h-3 w-3" />}
            sub="diagramas"
          />
          <StatCard
            label="Públicos"
            value={stats.public}
            icon={<Globe2 className="h-4 w-4 text-amber-400" />}
            subIcon={<Globe2 className="h-3 w-3" />}
            sub="compartilháveis"
          />
          <StatCard
            label="Arquivados"
            value={stats.archived}
            icon={<ArchiveX className="h-4 w-4 text-[var(--muted-fg)]" />}
            subIcon={<Archive className="h-3 w-3" />}
            sub={filters.archived ? "visualizando" : "ocultos"}
          />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Buscar projetos…"
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 py-2 pr-3 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)]"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => setSearchDraft("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-[var(--muted)] hover:text-slate-200"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ProjectFilters
              filters={filters}
              onChange={(partial) => {
                setFilters(partial);
                void loadProjects(partial);
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters({ archived: !filters.archived });
              void loadProjects({ archived: !filters.archived });
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              filters.archived
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-[var(--border)] text-[var(--muted-fg)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)]"
            }`}
          >
            {filters.archived ? <FolderKanban className="h-3.5 w-3.5" /> : <ArchiveX className="h-3.5 w-3.5" />}
            {filters.archived ? "Mostrar ativos" : "Ver arquivados"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && projects.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
                  <div className="skeleton mb-3 h-5 w-2/3" />
                  <div className="skeleton mb-2 h-3 w-full" />
                  <div className="skeleton h-3 w-4/5" />
                </div>
              ))}
            </div>
          ) : shownProjects.length === 0 ? (
            <EmptyState search={searchDraft} archived={!!filters.archived} onCreate={() => setModalOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!filters.archived && (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="group flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-transparent text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)] hover:text-indigo-300"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <FolderKanban className="h-3.5 w-3.5" />
                    Novo projeto
                  </span>
                </button>
              )}
              {shownProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onPin={() => void pinProject(p.id)}
                  onArchive={() => void archiveProject(p.id)}
                  onDelete={() => setConfirmDeleteId(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (data) => {
          const created = await createProject(data);
          setModalOpen(false);
          void loadProjects();
          router.push(`/project/${created.id}`);
        }}
      />

      <FirstProjectWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardDismissed(true);
          try {
            localStorage.setItem("archia-onboarded", "1");
          } catch {
            /* ignore */
          }
        }}
        onComplete={async (data) => {
          const created = await createProject({
            name: data.name,
            description: data.description,
            context: data.context,
          });
          setWizardDismissed(true);
          try {
            localStorage.setItem("archia-onboarded", "1");
          } catch {
            /* ignore */
          }
          return created.id;
        }}
      />

      {confirmDeleteId && (
        <ConfirmDialog
          title="Excluir projeto?"
          description="Remove o projeto e todos os diagramas. Não dá para desfazer."
          confirmLabel="Excluir"
          onConfirm={() => {
            void deleteProject(confirmDeleteId).then(() => setConfirmDeleteId(null));
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
  subIcon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
  subIcon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {sub && (
        <p className="mt-0.5 inline-flex items-center gap-2 text-sm text-[var(--muted-fg)]">
          {subIcon}
          {sub}
        </p>
      )}
    </div>
  );
}

function EmptyState({
  search,
  archived,
  onCreate,
}: {
  search: string;
  archived: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
        {archived ? (
          <ArchiveX className="h-6 w-6 text-[var(--muted)]" />
        ) : search ? (
          <Search className="h-6 w-6 text-[var(--muted)]" />
        ) : (
          <FolderKanban className="h-6 w-6 text-[var(--muted)]" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">
          {archived
            ? "Nenhum projeto arquivado."
            : search
              ? "Nenhum projeto encontrado."
              : "Nenhum projeto ainda."}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {archived
            ? "Restaurando projetos os torna visíveis novamente."
            : search
              ? "Tente ajustar os filtros ou a busca."
              : "Comece criando sua primeira arquitetura."}
        </p>
      </div>
      {!archived && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          Criar projeto
        </button>
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 elev-4">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-[var(--muted-fg)]">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--muted-fg)] hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
