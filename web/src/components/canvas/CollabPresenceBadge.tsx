"use client";

import { useEffect, useRef, useState } from "react";
import { createCollabProvider, type CollabPresence, type CollabProvider } from "@/lib/collab";
import { useAuthStore } from "@/lib/auth-store";
import { useGraphStore } from "@/lib/graph-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";

/**
 * Wires Yjs CRDT sync for the active graph when the user is authenticated.
 * Presence badge + remote snapshot apply (without fighting local typing).
 */
export default function CollabPresenceBadge() {
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const loadSnapshot = useGraphStore((s) => s.loadSnapshot);
  const name = useGraphStore((s) => s.name);
  const analysis = useGraphStore((s) => s.analysis);
  const context = useGraphStore((s) => s.context);
  const nfr = useGraphStore((s) => s.nfr);
  const user = useAuthStore((s) => s.user);
  const unresolvedComments = useGraphStore(
    (s) => s.canvasComments.filter((c) => !c.resolved).length,
  );
  const [peers, setPeers] = useState<CollabPresence[]>([]);
  const [connected, setConnected] = useState(false);
  const providerRef = useRef<CollabProvider | null>(null);
  const skipPush = useRef(false);

  useEffect(() => {
    if (!graphId || !user) return;
    const provider = createCollabProvider(
      graphId,
      String(user.id || user.email || "anon"),
      user.username || user.email || "Usuário",
    );
    providerRef.current = provider;
    provider.connect(API_BASE);
    const unsub = provider.subscribe((s) => {
      setPeers(s.peers);
      setConnected(s.connected);
    });
    const unsubGraph = provider.onGraphChange((snap) => {
      skipPush.current = true;
      try {
        loadSnapshot(
          name,
          snap.nodes as Parameters<typeof loadSnapshot>[1],
          snap.edges as Parameters<typeof loadSnapshot>[2],
          analysis,
          context,
          nfr,
        );
      } finally {
        queueMicrotask(() => {
          skipPush.current = false;
        });
      }
    });
    provider.seedFromSnapshot({ nodes, edges });
    return () => {
      unsub();
      unsubGraph();
      provider.disconnect();
      providerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect only on graph/user change
  }, [graphId, user?.id, user?.email]);

  useEffect(() => {
    if (!providerRef.current || skipPush.current) return;
    providerRef.current.pushLocalSnapshot({ nodes, edges });
  }, [nodes, edges]);

  if (!graphId || !user) return null;
  const others = peers.filter((p) => p.userId !== String(user.id || user.email));
  const count = Math.max(1, peers.length);
  const unresolved = unresolvedComments;

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/90 px-2.5 py-1.5 text-xs text-[var(--muted-fg)] backdrop-blur"
      title={connected ? "Colaboração Yjs ativa" : "Reconectando…"}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
        aria-hidden
      />
      <span>
        {count} online
        {others.length > 0 ? ` · ${others.map((p) => p.displayName).join(", ")}` : ""}
        {unresolved > 0 ? ` · ${unresolved} comentário${unresolved === 1 ? "" : "s"} ativo${unresolved === 1 ? "" : "s"}` : ""}
      </span>
      <div className="flex -space-x-1">
        {peers.slice(0, 5).map((p) => (
          <span
            key={p.userId}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: p.color }}
            title={p.displayName}
          >
            {p.displayName.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
