"use client";

import Tooltip from "@/components/ui/Tooltip";
import { diagramKindLabel } from "@/lib/diagram-library";
import { useAuthStore } from "@/lib/auth-store";
import { useGraphStore } from "@/lib/graph-store";
import { useProjectStore } from "@/lib/project-store";
import { api } from "@/lib/api";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

type DiagramSidebarProps = {
  collapsed?: boolean;
  onToggle?: (next: boolean) => void;
};

export default function DiagramSidebar({ collapsed: initialCollapsed, onToggle }: DiagramSidebarProps) {
  const { projects, activeProjectId, createProject, setActiveProject, deleteProject, loadProjects } =
    useProjectStore();
  const { isAuthenticated } = useAuthStore();
  const graphId = useGraphStore((s) => s.graphId);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [subsystems, setSubsystems] = useState<Array<{ id: string; name: string }>>([]);
  const [importId, setImportId] = useState("cdn-global");
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onToggle?.(next);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    void api.listSubsystems().then(setSubsystems).catch(() => undefined);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject({ name: newName.trim() });
    await loadProjects();
    setNewName("");
    setShowCreate(false);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <Tooltip content={collapsed ? "Expandir projetos" : "Recolher projetos"} side="right">
        <button
          type="button"
          onClick={toggle}
          className="absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-r-lg border border-r-0 border-[var(--border-strong)] bg-[var(--surface-1)]/90 p-2 text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          aria-label={collapsed ? "Expandir projetos" : "Recolher projetos"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </Tooltip>

      <aside
        className={`shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] transition-all duration-200 ${
          collapsed ? "w-0 overflow-hidden" : "w-56"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--border)] px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="panel-section-title inline-flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" />
                Projetos
              </span>
              <Tooltip content="Novo projeto">
                <button
                  type="button"
                  onClick={() => setShowCreate(!showCreate)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-[var(--foreground)]"
                  aria-label="Novo projeto"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>

            {showCreate && (
              <div className="mt-2 space-y-1">
                <label htmlFor="diagram-sidebar-new-name" className="block px-0.5 text-[12px] font-medium text-[var(--muted)]">
                  Nome do projeto
                </label>
                <div className="flex gap-2">
                <input
                  id="diagram-sidebar-new-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: Checkout"
                  className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-2 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                  autoFocus
                />
                <Tooltip content="Criar">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    className="inline-flex min-h-6 min-w-6 items-center gap-2 rounded-lg bg-[var(--accent)] px-2.5 py-2 text-[12px] font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {projects.length === 0 && !showCreate ? (
              <div className="panel-empty px-3">
                <div className="panel-empty-icon">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <p className="text-sm text-[var(--muted)]">Nenhum projeto ainda</p>
                <p className="panel-hint">Crie o primeiro para começar a desenhar</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Criar primeiro projeto
                </button>
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className={`group ${activeProjectId === project.id ? "bg-white/5" : ""}`}
                >
                  <div
                    className={`flex cursor-pointer items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/5 ${
                      activeProjectId === project.id ? "border-l-2 border-[var(--accent)]" : ""
                    }`}
                    onClick={() => setActiveProject(project.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{project.name}</p>
                      <p className="text-[12px] text-[var(--muted)]">
                        {project.diagrams?.length ?? 0} diagramas
                      </p>
                    </div>
                    <Tooltip content="Excluir projeto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Excluir "${project.name}"?`)) {
                            void deleteProject(project.id);
                          }
                        }}
                        className="rounded p-1 text-[var(--muted-fg)] opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label={`Excluir ${project.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>

                  {activeProjectId === project.id && project.diagrams?.length ? (
                    <ul className="border-t border-[var(--border)] pb-1">
                      {project.diagrams.map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            className={`w-full px-4 py-2 text-left text-[12px] ${
                              graphId === d.id
                                ? "bg-[var(--accent-muted)] text-indigo-200"
                                : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
                            }`}
                            onClick={() => loadGraph(d)}
                          >
                            <span className="font-medium">{diagramKindLabel(d.diagram_kind)}</span>
                            <span className="mt-0.5 block truncate text-sm text-[var(--muted-fg)]">{d.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-[var(--border)] px-3 py-2.5">
            {activeProjectId && (
              <div className="space-y-2">
                <p className="panel-section-title inline-flex items-center gap-2">
                  <Download className="h-3 w-3" />
                  Importar subsystem
                </p>
                <select
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-2 text-[12px] text-[var(--foreground)]"
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                  aria-label="Subsystem"
                >
                  {(subsystems.length ? subsystems : [{ id: "cdn-global", name: "CDN global" }]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2 py-2 text-[12px] font-medium text-[var(--muted)] hover:bg-white/10 hover:text-[var(--foreground)]"
                  onClick={async () => {
                    try {
                      const graph = await api.importSubsystem(activeProjectId, {
                        subsystem_id: importId,
                        merge_into_graph_id: graphId ?? undefined,
                      });
                      loadGraph(graph);
                      await loadProjects();
                      pushUiNotice({ type: "success", text: `Subsystem ${importId} importado.` });
                    } catch (err) {
                      pushUiNotice({
                        type: "error",
                        text: err instanceof Error ? err.message : "Falha ao importar subsystem",
                      });
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Importar no diagrama
                </button>
              </div>
            )}
            <p className="text-center text-[12px] text-[var(--muted-fg)]">
              {projects.length} projeto{projects.length !== 1 ? "s" : ""}
              {activeProject?.diagrams?.length ? ` · ${activeProject.diagrams.length} vistas` : ""}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
