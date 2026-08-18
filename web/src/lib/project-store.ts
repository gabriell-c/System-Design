import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Project } from './types';
import { api } from './api';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string, context?: string) => Promise<Project>;
  setActiveProject: (id: string | null) => void;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,
      isLoading: false,

      loadProjects: async () => {
        set({ isLoading: true });
        try {
          const resp = await api.listProjects();
          set({ projects: resp, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      createProject: async (name, context = '') => {
        const resp = await api.createProject({ name, context, nfr_json: '{}' });
        set(state => ({
          projects: [resp, ...state.projects],
          activeProjectId: resp.id,
        }));
        return resp;
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      deleteProject: async (id) => {
        await api.deleteProject(id);
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      updateProject: async (id, updates) => {
        const resp = await api.updateProject(id, updates);
        set(state => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },
    }),
    { name: 'archia-projects' }
  )
);
