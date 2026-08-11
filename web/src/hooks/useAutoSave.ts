import { useEffect, useRef } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { useAuthStore } from "@/lib/auth-store";

export function useAutoSave() {
  const user = useAuthStore((s) => s.user);
  const graphId = useGraphStore((s) => s.graphId);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!user || !user.auto_save_enabled || !graphId) return;
    const ms = user.auto_save_interval_minutes * 60 * 1000;
    timerRef.current = setInterval(() => {
      const state = useGraphStore.getState();
      if (state.graphId) {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
        fetch(`${base}/api/v1/graphs/${state.graphId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: state.nodes,
            edges: state.edges,
          }),
        }).catch(console.error);
      }
    }, ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, graphId]);
}
