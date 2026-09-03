"use client";

import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import { useProjectStore } from "@/lib/project-store";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorBoundary from "@/components/layout/ErrorBoundary";

const EditorShell = dynamic(() => import("@/components/layout/EditorShell"), { 
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center bg-[var(--surface-1)]">Carregando...</div>,
});

export default function ProjectEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const { isAuthenticated, isLoading: authLoading, fetchProfile } = useAuthStore();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const upsertProject = useProjectStore((s) => s.upsertProject);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated && !projectId) {
      router.push("/login");
      return;
    }

    if (!isAuthenticated && projectId) {
      (async () => {
        try {
          const project = await api.getProject(projectId);
          if (!project.is_public) {
            router.push("/login");
          }
        } catch {
          router.push("/login");
        }
      })();
    }
  }, [authLoading, isAuthenticated, projectId, router]);

  useEffect(() => {
    if (!isAuthenticated || !projectId) return;
    
    // AbortController to cancel in-flight requests
    const controller = new AbortController();
    
    // STEP 1: Reset graph store IMMEDIATELY
    console.log(`[ProjectPage:${projectId}] RESET graph store`);
    useGraphStore.getState().reset();
    
    setReady(false);
    setError(null);

    (async () => {
      try {
        const project = await api.getProject(projectId);
        if (controller.signal.aborted) return;

        const diagrams = await api.listProjectDiagrams(project.id);
        if (controller.signal.aborted) return;

        console.log(`[ProjectPage:${projectId}] Project ${project.id} has ${diagrams.length} diagrams`);
        
        upsertProject({ ...project, diagrams });
        
        // STEP 2: Set active project (this triggers store reset in project-store)
        setActiveProject(project.id);
        
        const primary =
          project.project_kind === "free"
            ? diagrams.find((d) => d.diagram_kind === "free") ?? diagrams[0]
            : diagrams.find((d) => d.diagram_kind === "application") ??
              diagrams.find((d) => d.diagram_kind === "context") ??
              diagrams[0];

        console.log(`[ProjectPage:${projectId}] Primary diagram: ${primary?.id} (kind: ${primary?.diagram_kind})`);

        if (primary) {
          const full = await api.getGraph(primary.id);
          if (controller.signal.aborted) return;

          console.log(`[ProjectPage:${projectId}] Loaded graph ${full.id}, project_id=${full.project_id}, nodes=${(full.nodes as any[])?.length}`);

          // STRICT validation: graph MUST belong to current project
          if (full.project_id && full.project_id !== project.id) {
            console.error(`[ProjectPage:${projectId}] BUG: Graph ${full.id} belongs to project ${full.project_id}, NOT ${project.id}!`);
            useGraphStore.getState().reset();
            setReady(true);
            return;
          }

          // STEP 3: Load graph into store
          loadGraph(full);
          const storeState = useGraphStore.getState();
          console.log(`[ProjectPage:${projectId}] Store after load: graphId=${storeState.graphId}, nodes=${storeState.nodes.length}`);
        } else {
          console.log(`[ProjectPage:${projectId}] No diagrams found`);
        }
        
        if (!controller.signal.aborted) {
          setReady(true);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Projeto não encontrado");
        }
      }
    })();

    return () => {
      controller.abort();
      console.log(`[ProjectPage:${projectId}] Cleanup - aborted`);
    };
  }, [isAuthenticated, projectId, setActiveProject, upsertProject, loadGraph]);

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-rose-300">{error}</p>
        <Link href="/" className="text-sm text-indigo-300 hover:underline">Voltar ao dashboard</Link>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {ready ? <EditorShell key={projectId} /> : (
          <div className="flex min-h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-muted)]">
                <svg className="h-5 w-5 animate-spin text-[var(--accent)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--muted-fg)]">Carregando projeto…</p>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
