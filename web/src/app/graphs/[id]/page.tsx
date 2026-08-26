"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Compat: /graphs/<graphId> → /project/<projectId>
 * Se o grafo não tiver projeto, cai no dashboard.
 */
export default function GraphByIdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getGraph(params.id)
      .then((graph) => {
        if (cancelled) return;
        if (graph.project_id) {
          router.replace(`/project/${graph.project_id}`);
        } else {
          router.replace("/");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não encontrado");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  return (
    <div className="px-6 py-10">
      {error ? (
        <div>
          <p className="text-sm text-rose-300">{error}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-indigo-300">
            Voltar ao dashboard
          </Link>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-fg)]">Redirecionando para o projeto…</p>
      )}
    </div>
  );
}
