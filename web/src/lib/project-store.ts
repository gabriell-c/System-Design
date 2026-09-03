"use client";

import { create } from "zustand";
import { api } from "./api";
import { useGraphStore } from "./graph-store";

export type Project = {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  project_kind?: "architecture" | "free";
  created_at: string;
  updated_at?: string;
  diagrams?: Array<{ id: string; diagram_kind?: string }>;
};

type ProjectState = {
  projects: Project[];
  isLoading: boolean;
  filters: {
    archived: boolean;
    pinned: boolean;
    public: boolean;
  };
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  setFilters: (filters: Partial<ProjectState["filters"]>) => void;
  createProject: (data: {
    name: string;
    description?: string;
    project_kind?: "architecture" | "free";
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

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await api.listProjects();
      set({ projects, isLoading: false });
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
    
    // FIX: Reset graph store when switching projects
    if (state.activeProjectId !== id) {
      const graphStore = useGraphStore.getState();
      const currentGraphProjectId = graphStore.projectId;
      
      // Only reset if we're switching to a different project
      if (currentGraphProjectId && currentGraphProjectId !== id) {
        console.log(`[ProjectStore] Switching from project ${currentGraphProjectId} to ${id}, resetting graph`);
        graphStore.reset();
      }
    }
    
    set({ activeProjectId: id });
  },
}));
