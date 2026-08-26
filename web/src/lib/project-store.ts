import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Project, ProjectAccessEntry, ProjectListFilters } from './types';
import { api } from './api';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;
  filters: ProjectListFilters;

  setFilters: (partial: Partial<ProjectListFilters>) => void;
  loadProjects: (overrides?: Partial<ProjectListFilters>) => Promise<void>;
  createProject: (input: {
    name: string;
    description?: string;
    context?: string;
    is_public?: boolean;
    project_kind?: string;
    access_list?: ProjectAccessEntry[];
  }) => Promise<Project>;
  setActiveProject: (id: string | null) => void;
  upsertProject: (project: Project) => void;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project> & { access_list?: ProjectAccessEntry[] }) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  pinProject: (id: string) => Promise<void>;
}

const defaultFilters: ProjectListFilters = {
  search: '',
  sort_by: 'recent',
  archived: false,
  pinned_first: true,
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      isLoading: false,
      filters: defaultFilters,

      setFilters: (partial) =>
        set((state) => ({ filters: { ...state.filters, ...partial } })),

      loadProjects: async (overrides) => {
        const filters = { ...get().filters, ...overrides };
        set({ isLoading: true, filters });
        try {
          const resp = await api.listProjects({
            search: filters.search || undefined,
            sort_by: filters.sort_by,
            archived: filters.archived ?? false,
            pinned_first: filters.pinned_first ?? true,
            limit: 50,
            offset: 0,
          });
          const projects = Array.isArray(resp) ? resp : (resp.items ?? []);
          const withDiagrams = await Promise.all(
            projects.map(async (p) => {
              try {
                const diagrams = await api.listProjectDiagrams(p.id);
                return { ...p, diagrams };
              } catch {
                return { ...p, diagrams: p.diagrams ?? [] };
              }
            }),
          );
          set({ projects: withDiagrams, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      createProject: async (input) => {
        const resp = await api.createProject({
          name: input.name,
          description: input.description ?? '',
          context: input.context ?? '',
          nfr_json: '{}',
          is_public: input.is_public ?? false,
          project_kind: input.project_kind ?? 'architecture',
          access_list: input.access_list ?? [],
        });
        const diagrams = await api.listProjectDiagrams(resp.id);
        const full = { ...resp, diagrams, nfr: null };
        set((state) => ({
          projects: [full, ...state.projects],
          activeProjectId: resp.id,
        }));
        return full;
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      upsertProject: (project) =>
        set((state) => {
          const idx = state.projects.findIndex((p) => p.id === project.id);
          if (idx >= 0) {
            const projects = [...state.projects];
            projects[idx] = { ...projects[idx], ...project };
            return { projects };
          }
          return { projects: [project, ...state.projects] };
        }),

      deleteProject: async (id) => {
        await api.deleteProject(id);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      updateProject: async (id, updates) => {
        const resp = await api.updateProject(id, updates);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...resp, diagrams: p.diagrams } : p,
          ),
        }));
      },

      archiveProject: async (id) => {
        const resp = await api.archiveProject(id);
        set((state) => ({
          projects: state.projects
            .map((p) => (p.id === id ? { ...p, ...resp, diagrams: p.diagrams } : p))
            .filter((p) => Boolean(p.archived) === Boolean(state.filters.archived)),
        }));
      },

      pinProject: async (id) => {
        const resp = await api.pinProject(id);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...resp, diagrams: p.diagrams } : p,
          ),
        }));
        await get().loadProjects();
      },
    }),
    {
      name: 'archia-projects',
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        filters: state.filters,
      }),
    },
  ),
);
