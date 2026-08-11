"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useEffect as useEffectAuth } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { GraphRecord } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  analyzed: "Analisada",
  approved: "Aprovada",
  rejected: "Rejeitada",
  pending_review: "Em revisão",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export default function GraphsPage() {
  const [rows, setRows] = useState<GraphRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const { confirm, dialog } = useConfirmDialog();
  const { isAuthenticated, isLoading: authLoading, fetchProfile } = useAuthStore();
  const router = useRouter();

  useEffectAuth(() => { fetchProfile(); }, [fetchProfile]);
  useEffectAuth(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listGraphs();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao listar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [refresh]);

  async function handleDelete(row: GraphRecord) {
    const ok = await confirm({
      title: `Excluir “${row.name}”?`,
      description: "A arquitetura será removida do servidor.",
      consequences: "Esta ação não pode ser desfeita pelo Ctrl+Z do editor.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    await api.deleteGraph(row.id);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {dialog}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Arquiteturas salvas</h1>
          <p className="mt-1 text-sm text-slate-400">Abra um desenho no editor ou exclua o que não precisa mais.</p>
        </div>
        <Link href="/" className="btn-primary">
          Voltar ao editor
        </Link>
      </div>
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Carregando…</p>}
      <ul className="space-y-2">
        {rows.map((row) => {
          const score =
            row.analysis && typeof row.analysis === "object" && "score" in row.analysis
              ? Number((row.analysis as { score?: number }).score)
              : null;
          const nodeCount = Array.isArray(row.nodes) ? row.nodes.length : 0;
          return (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121821] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{row.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {statusLabel(row.review_status)}
                  {score != null && Number.isFinite(score) ? ` · nota ${score.toFixed(1)}` : ""}
                  {` · ${nodeCount} node${nodeCount === 1 ? "" : "s"}`}
                  {` · ${new Date(row.updated_at).toLocaleString("pt-BR")}`}
                </p>
                {row.context?.trim() && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{row.context.trim()}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href="/" className="btn-primary" onClick={() => loadGraph(row)}>
                  Abrir
                </Link>
                <button type="button" className="btn-ghost text-rose-200" onClick={() => void handleDelete(row)}>
                  Excluir
                </button>
              </div>
            </li>
          );
        })}
        {!loading && rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
            Nenhuma arquitetura salva ainda. No editor, clique em <strong className="text-slate-300">Salvar</strong>.
          </li>
        )}
      </ul>
    </div>
  );
}
