"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";

type Annotation = {
  id: string;
  graph_id: string;
  node_id: string | null;
  text: string;
  author: string;
  created_at: string;
};

type Props = {
  nodeId: string;
};

/** Node annotations UI backed by /annotations API (T14). */
export default function NodeAnnotations({ nodeId }: Props) {
  const graphId = useGraphStore((s) => s.graphId);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const [items, setItems] = useState<Annotation[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!graphId) return;
    try {
      const rows = await api.listAnnotations(graphId, nodeId);
      setItems(rows);
    } catch {
      /* silent — graph may be local-only */
    }
  }, [graphId, nodeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!graphId) {
    return (
      <p className="text-xs text-[var(--muted-fg)]">
        Salve o diagrama para sincronizar anotações no servidor.
      </p>
    );
  }

  async function add() {
    const body = text.trim();
    if (!body) return;
    setLoading(true);
    try {
      await api.createAnnotation(graphId!, { node_id: nodeId, text: body });
      setText("");
      await reload();
      pushUiNotice({ type: "success", text: "Anotação salva." });
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha ao salvar anotação",
      });
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteAnnotation(graphId!, id);
      await reload();
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha ao remover",
      });
    }
  }

  return (
    <div className="space-y-2" data-testid="node-annotations">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Anotações</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 text-xs"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-slate-200">{a.text}</span>
              <span className="text-[var(--muted-fg)]">{a.author}</span>
            </span>
            <button
              type="button"
              className="btn-ghost p-1 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Remover anotação"
              onClick={() => void remove(a.id)}
            >
              <Trash2 size={12} aria-hidden />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-[var(--muted-fg)]">Nenhuma anotação neste nó.</li>
        )}
      </ul>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova anotação…"
          aria-label="Texto da anotação"
        />
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1 px-2 text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          disabled={loading || !text.trim()}
          onClick={() => void add()}
          aria-label="Adicionar anotação"
        >
          <MessageSquarePlus size={12} aria-hidden />
          Add
        </button>
      </div>
    </div>
  );
}
