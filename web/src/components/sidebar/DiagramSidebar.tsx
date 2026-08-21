"use client";

import { Check, ChevronLeft, ChevronRight, FolderKanban, FolderOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { diagramKindLabel } from "@/lib/diagram-library";
import { useProjectStore } from "@/lib/project-store";
import { useAuthStore } from "@/lib/auth-store";
import { useGraphStore } from "@/lib/graph-store";
import { api } from "@/lib/api";

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
      {/* Collapse toggle button */}
      <button
        type="button"
        onClick={toggle}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-r-lg border border-r-0 border-white/10 bg-[#0a0f18]/90 p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
        aria-label={collapsed ? "Expandir projetos" : "Recolher projetos"}
        title={collapsed ? "Expandir projetos" : "Recolher projetos"}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <aside
        className={`shrink-0 border-r border-white/8 bg-[#0a0f18] transition-all duration-200 ${
          collapsed ? "w-0 overflow-hidden" : "w-56"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/8 px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <FolderKanban className="h-3.5 w-3.5" />
                Projetos
              </span>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                title="Novo projeto"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showCreate && (
              <div className="mt-2 flex gap-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do projeto…"
                  className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-slate-600 focus:border-[var(--accent)]/40 focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                  autoFocus
                />
                <button
                  onClick={() => void handleCreate()}
                  className="inline-flex items-center gap-1 rounded bg-[var(--accent)] px-2 py-1 text-xs text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <Check className="h-3 w-3" />
                  Criar
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {projects.length === 0 && !showCreate ? (
              <div className="px-3 py-6 text-center">
                <FolderOpen className="mx-auto mb-2 h-6 w-6 text-slate-600" />
                <p className="text-xs text-slate-500">Nenhum projeto ainda</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-90"
                >
                  <Plus className="h-3 w-3" />
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
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${
                      activeProjectId === project.id ? "border-l-2 border-cyan-500" : ""
                    }`}
                    onClick={() => setActiveProject(project.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{project.name}</p>
                      <p className="text-xs text-slate-500">
                        {project.diagrams?.length ?? 0} diagramas
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Excluir "${project.name}"?`)) {
                          void deleteProject(project.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 px-1 text-slate-500 hover:text-rose-400 transition-all"
                      title="Excluir"
                    >
                      ×
                    </button>
                  </div>

                  {activeProjectId === project.id && project.diagrams?.length ? (
                    <ul className="border-t border-white/8 pb-1">
                      {project.diagrams.map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            className={`w-full px-4 py-1.5 text-left text-[11px] ${
                              graphId === d.id
                                ? "text-cyan-300 bg-cyan-500/10"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            }`}
                            onClick={() => loadGraph(d)}
                          >
                            <span className="font-medium">{diagramKindLabel(d.diagram_kind)}</span>
                            <span className="block truncate text-[10px] opacity-70">{d.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-white/8 px-3 py-2">
            {activeProjectId && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-slate-600">Importar subsystem</p>
                <select
                  className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-200"
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                >
                  {(subsystems.length ? subsystems : [{ id: "cdn-global", name: "CDN global" }]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="w-full rounded bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
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
                  Importar no diagrama
                </button>
              </div>
            )}
            <p className="text-xs text-slate-600 text-center">
              {projects.length} projeto{projects.length !== 1 ? "s" : ""}
              {activeProject?.diagrams?.length ? ` · ${activeProject.diagrams.length} vistas` : ""}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
