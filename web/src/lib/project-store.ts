"use client";

import { create } from "zustand";
import { api } from "./api";
import { useGraphStore } from "./graph-store";
import type { Project as ProjectType } from "./types";

export type Project = ProjectType;

type ProjectState = {
  projects: Project[];
  isLoading: boolean;
  filters: {
    archived: boolean;
    pinned: boolean;
    public: boolean;
    search?: string;
  };
  activeProjectId: string | null;
  loadProjects: (filters?: { search?: string; archived?: boolean }) => Promise<void>;
  setFilters: (filters: Partial<ProjectState["filters"]>) => void;
  createProject: (data: {
    name: string;
    description?: string;
    context?: string;
    is_public?: boolean;
    project_kind?: "architecture" | "free";
    access_list?: Array<{ email: string; role: "read" | "full" }>;
  }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  pinProject: (id: string) => Promise<void>;
  upsertProject: (project: Project) => void;
  setActiveProject: (id: string | null) => void;
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  isLoading: true,
  filters: {
    archived: false,
    pinned: false,
    public: false,
  },
  activeProjectId: null,

  loadProjects: async (filters?) => {
    set({ isLoading: true });
    try {
      const result = await api.listProjects(filters);
      set({ projects: result.items, isLoading: false });
    } catch (error) {
      console.error("Failed to load projects:", error);
      set({ isLoading: false });
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  createProject: async (data) => {
    const project = await api.createProject(data);
    set((state) => ({
      projects: [project, ...state.projects],
    }));
    return project;
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    }));
  },

  archiveProject: async (id) => {
    await api.archiveProject(id);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, is_public: false } : p
      ),
    }));
  },

  pinProject: async (id) => {
    await api.pinProject(id);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, is_public: !p.is_public } : p
      ),
    }));
  },

  upsertProject: (project) => {
    set((state) => {
      const index = state.projects.findIndex((p) => p.id === project.id);
      if (index >= 0) {
        const newProjects = [...state.projects];
        newProjects[index] = project;
        return { projects: newProjects };
      }
      return { projects: [project, ...state.projects] };
    });
  },

  setActiveProject: (id) => {
    const state = get();

    // ALWAYS reset graph when switching to a different project — isolation guarantee
    if (state.activeProjectId !== id) {
      console.log(`[ProjectStore] Switching project: ${state.activeProjectId} -> ${id}, resetting graph`);
      useGraphStore.getState().reset();
      const after = useGraphStore.getState();
      console.log(
        `[ProjectStore] After reset: graphId=${after.graphId}, projectId=${after.projectId}, nodes=${after.nodes.length}, excalidraw=${after.excalidrawElements.length}`,
      );
    }

    set({ activeProjectId: id });
  },
}));
