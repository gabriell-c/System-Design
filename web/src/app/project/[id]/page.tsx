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

const EditorShell = dynamic(() => import("@/components/layout/EditorShell"), { ssr: false });

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
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);

    (async () => {
      try {
        const project = await api.getProject(projectId);
        if (cancelled) return;

        const diagrams = await api.listProjectDiagrams(project.id);
        if (cancelled) return;

        upsertProject({ ...project, diagrams });
        setActiveProject(project.id);

        const primary =
          project.project_kind === "free"
            ? diagrams.find((d) => d.diagram_kind === "free") ?? diagrams[0]
            : diagrams.find((d) => d.diagram_kind === "application") ??
              diagrams.find((d) => d.diagram_kind === "context") ??
              diagrams[0];

        if (primary) {
          const full = await api.getGraph(primary.id);
          if (cancelled) return;
          loadGraph(full);
        }
        setReady(true);
      } catch (err) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!cancelled) setError(err instanceof Error ? err.message : "Projeto não encontrado");
      }
    })();

    return () => { cancelled = true; };
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
        {ready ? <EditorShell /> : (
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
