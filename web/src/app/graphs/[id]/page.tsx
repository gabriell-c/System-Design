"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";

export default function GraphByIdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getGraph(params.id)
      .then((graph) => {
        if (cancelled) return;
        loadGraph(graph);
        router.replace("/");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não encontrado");
      });
    return () => {
      cancelled = true;
    };
  }, [loadGraph, params.id, router]);

  return (
    <div className="px-6 py-10">
      {error ? (
        <div>
          <p className="text-sm text-rose-300">{error}</p>
          <Link href="/graphs" className="mt-4 inline-block text-sm text-cyan-300">
            Voltar
          </Link>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Carregando arquitetura…</p>
      )}
    </div>
  );
}
