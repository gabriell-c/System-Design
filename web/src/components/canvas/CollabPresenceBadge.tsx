"use client";

import { useEffect, useRef, useState } from "react";
import {
  createCollabProvider,
  type CollabAuthError,
  type CollabPresence,
  type CollabProvider,
  type MergedGraphSnapshot,
} from "@/lib/collab";
import { useAuthStore } from "@/lib/auth-store";
import { useGraphStore } from "@/lib/graph-store";
import type { AnalysisResult, CanvasNodeData, ProjectNfr } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { API_BASE } from "@/lib/api-base";

/**
 * Wires real-time collaboration for the active graph when the user is
 * authenticated. Presence is server-injected (token-trusted); remote state is
 * merged element-wise and applied through graph-store.applyRemote — no undo
 * entry, no dirty flag, no Excalidraw clobber.
 */
export default function CollabPresenceBadge() {
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const excalidrawElements = useGraphStore((s) => s.excalidrawElements);
  const applyRemote = useGraphStore((s) => s.applyRemote);
  const user = useAuthStore((s) => s.user);
  const unresolvedComments = useGraphStore(
    (s) => s.canvasComments.filter((c) => !c.resolved).length,
  );
  const [peers, setPeers] = useState<CollabPresence[]>([]);
  const [connected, setConnected] = useState(false);
  const [authError, setAuthError] = useState<CollabAuthError | null>(null);
  const providerRef = useRef<CollabProvider | null>(null);

  // One provider per graph: seed from the live store state (fresh read, not a
  // stale closure) and apply remote merges through applyRemote.
  useEffect(() => {
    if (!graphId || !user) return;
    const provider = createCollabProvider(graphId);
    providerRef.current = provider;

    const state = useGraphStore.getState();
    provider.seedFromSnapshot({
      nodes: state.nodes,
      edges: state.edges,
      excalidrawElements: state.excalidrawElements,
      name: state.name,
      context: state.context,
      nfr: state.nfr,
    });

    provider.connect(API_BASE);

    const unsubscribe = provider.subscribe((s) => {
      setPeers(s.peers);
      setConnected(s.connected);
      setAuthError(s.authError);
    });

    const unsubscribeGraph = provider.onGraphChange((merged: MergedGraphSnapshot) => {
      applyRemote({
        nodes: (merged.nodes ?? []) as Node<CanvasNodeData>[],
        edges: (merged.edges ?? []) as Edge[],
        excalidrawElements: (merged.excalidrawElements ?? []) as ExcalidrawElement[],
        // Pass-through apenas quando o snapshot remoto carrega o campo —
        // undefined nunca sobrescreve o estado local.
        name: merged.name,
        analysis:
          merged.analysis !== undefined ? (merged.analysis as AnalysisResult) : undefined,
        context: merged.context,
        nfr: merged.nfr !== undefined ? (merged.nfr as ProjectNfr) : undefined,
      });
    });

    return () => {
      unsubscribe();
      unsubscribeGraph();
      provider.close();
      providerRef.current = null;
      setPeers([]);
      setConnected(false);
      setAuthError(null);
    };
  }, [graphId, user, applyRemote]);

  // Push local structural changes (throttled by the provider).
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.pushLocalSnapshot({
      nodes,
      edges,
      excalidrawElements,
    });
  }, [nodes, edges, excalidrawElements]);

  if (!user) return null;

  if (authError) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300"
        title={
          authError === "auth"
            ? "Autenticação da colaboração falhou (código 4001) — verifique a sessão e recarregue."
            : "Sala indisponível ou cheia (código 4003)."
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        {authError === "auth" ? "Colaboração indisponível (autenticação)" : "Sala indisponível"}
        {unresolvedComments > 0 && (
          <span className="ml-1 rounded-full bg-white/10 px-1.5 py-px">{unresolvedComments} comentários</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--muted-fg)]"
      title={
        connected
          ? "Sincronização em tempo real ativa"
          : "Colaboração não conectada — tentando reconectar…"
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
        }`}
      />
      <span className="text-[var(--fg)]">{peers.length || 1}</span>
      <div className="flex -space-x-1.5">
        {peers.slice(0, 4).map((p) => (
          <span
            key={p.userId}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--surface-1)] text-[10px] font-semibold text-white"
            style={{ backgroundColor: p.color }}
            title={p.displayName}
          >
            {p.displayName.slice(0, 1).toUpperCase() || "?"}
          </span>
        ))}
      </div>
      {unresolvedComments > 0 && (
        <span className="ml-1 rounded-full bg-indigo-500/15 px-1.5 py-px text-indigo-300">
          {unresolvedComments} comentários
        </span>
      )}
    </div>
  );
}
