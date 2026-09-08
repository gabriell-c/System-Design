"use client";

import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import { useProjectStore } from "@/lib/project-store";
import {
  clearDraftForProject,
  draftLooksNewerThanServer,
  getDraftForProjectAsync,
  type LocalDraft,
} from "@/lib/local-draft";
import type { GraphRecord } from "@/lib/types";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorBoundary from "@/components/layout/ErrorBoundary";

const EditorShell = dynamic(() => import("@/components/layout/EditorShell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[var(--surface-1)]">Carregando...</div>
  ),
});

function applyDraftOntoGraph(full: GraphRecord, draft: LocalDraft): GraphRecord {
  return {
    ...full,
    name: draft.name || full.name,
    context: draft.context ?? full.context,
    nfr: draft.nfr ?? full.nfr,
    nodes: draft.nodes ?? full.nodes,
    edges: draft.edges ?? full.edges,
    analysis: draft.analysis ?? full.analysis,
    excalidraw_elements:
      (draft.excalidraw_elements as GraphRecord["excalidraw_elements"]) ?? full.excalidraw_elements,
  };
}

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
  const [pendingDraft, setPendingDraft] = useState<{
    draft: LocalDraft;
    serverGraph: GraphRecord;
  } | null>(null);

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

    const controller = new AbortController();

    useGraphStore.getState().reset();
    setReady(false);
    setError(null);
    setPendingDraft(null);

    (async () => {
      try {
        const project = await api.getProject(projectId);
        if (controller.signal.aborted) return;

        let diagrams = await api.listProjectDiagrams(project.id);
        if (controller.signal.aborted) return;

        // Projeto sem diagrama: cria um interno automaticamente (sem pedir arquivo no PC).
        if (diagrams.length === 0) {
          const created = await api.autoInitProjectDiagram(project.id);
          if (controller.signal.aborted) return;
          diagrams = [created];
        }

        upsertProject({ ...project, diagrams });
        setActiveProject(project.id);

        let primary: GraphRecord | undefined;
        if (project.project_kind === "free") {
          primary = diagrams.find((d) => d.diagram_kind === "free") ?? diagrams[0];
        } else {
          primary =
            diagrams.find((d) => d.diagram_kind === "application") ??
            diagrams.find((d) => d.diagram_kind === "context") ??
            diagrams[0];
        }

        if (!primary) {
          const created = await api.autoInitProjectDiagram(project.id);
          if (controller.signal.aborted) return;
          primary = created;
        }

        const full = await api.getGraph(primary.id);
        if (controller.signal.aborted) return;

        if (full.project_id && full.project_id !== project.id) {
          console.error(
            `[ProjectPage:${projectId}] Graph ${full.id} belongs to ${full.project_id}, not ${project.id}`,
          );
          useGraphStore.getState().reset();
          setReady(true);
          return;
        }

        // Garante projectId no store mesmo se o graph veio sem FK preenchida no client.
        if (!full.project_id) {
          full.project_id = project.id;
        }

        const draft = await getDraftForProjectAsync(project.id, full.id);
        const serverNodes = Array.isArray(full.nodes) ? full.nodes.length : 0;
        const serverEx = Array.isArray(full.excalidraw_elements) ? full.excalidraw_elements.length : 0;

        if (draft && draftLooksNewerThanServer(draft, full.updated_at, serverNodes, serverEx)) {
          // Se o servidor esta vazio, recupera automaticamente; senao pede confirmacao.
          if (serverNodes === 0 && serverEx === 0) {
            loadGraph(applyDraftOntoGraph(full, draft));
            useGraphStore.setState({ dirty: true, projectId: project.id });
            useGraphStore.getState().pushUiNotice({
              type: "info",
              text: "Rascunho local recuperado e associado a este projeto.",
            });
          } else {
            loadGraph(full);
            setPendingDraft({ draft, serverGraph: full });
          }
        } else {
          loadGraph(full);
        }

        if (!controller.signal.aborted) {
          setReady(true);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(`[ProjectPage:${projectId}] Error:`, err);
          setError(err instanceof Error ? err.message : "Projeto não encontrado");
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, projectId, setActiveProject, upsertProject, loadGraph]);

  function recoverDraft() {
    if (!pendingDraft) return;
    loadGraph(applyDraftOntoGraph(pendingDraft.serverGraph, pendingDraft.draft));
    useGraphStore.setState({ dirty: true, projectId: projectId ?? null });
    useGraphStore.getState().pushUiNotice({
      type: "success",
      text: "Rascunho local aplicado. Será salvo no projeto em instantes.",
    });
    setPendingDraft(null);
  }

  function discardDraft() {
    if (projectId) clearDraftForProject(projectId);
    setPendingDraft(null);
  }

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
        <Link href="/" className="text-sm text-indigo-300 hover:underline">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {pendingDraft ? (
          <div className="z-50 flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            <span>
              Encontramos um rascunho local mais recente deste projeto. Recuperar no canvas?
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-md px-3 py-1 text-xs text-amber-200/80 hover:bg-amber-500/10"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={recoverDraft}
                className="rounded-md bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-500/30"
              >
                Recuperar rascunho
              </button>
            </div>
          </div>
        ) : null}
        {ready ? (
          <EditorShell key={projectId} />
        ) : (
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
