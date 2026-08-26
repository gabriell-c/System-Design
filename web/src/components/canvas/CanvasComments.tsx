"use client";

import { MessageSquarePlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { api } from "@/lib/api";
import { useGraphStore } from "@/lib/graph-store";
import type { CanvasComment } from "@/lib/types";

/** P1.4.1 + P1.4.2 — Figma-style canvas comments with @mentions */
export default function CanvasComments() {
  const graphId = useGraphStore((s) => s.graphId);
  const comments = useGraphStore((s) => s.canvasComments);
  const setCanvasComments = useGraphStore((s) => s.setCanvasComments);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const { screenToFlowPosition } = useReactFlow();
  const [mode, setMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!graphId) return;
    void api
      .listComments(graphId)
      .then((rows) =>
        setCanvasComments(
          rows.map((r) => ({
            id: r.id,
            nodeId: r.node_id ?? r.nodeId,
            text: r.text,
            author: r.author,
            created_at: r.created_at,
            position_x: r.position_x,
            position_y: r.position_y,
            resolved: r.resolved,
            assignee: r.assignee,
            mentions: r.mentions,
          })),
        ),
      )
      .catch(() => undefined);
  }, [graphId, setCanvasComments]);

  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!mode || !graphId) return;
      const target = e.target as HTMLElement;
      if (target.closest(".canvas-comment-pin")) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPendingPos(pos);
    },
    [mode, graphId, screenToFlowPosition],
  );

  async function submitComment() {
    if (!graphId || !pendingPos || !draft.trim()) return;
    try {
      const row = await api.createComment(graphId, {
        text: draft.trim(),
        position_x: pendingPos.x,
        position_y: pendingPos.y,
      });
      setCanvasComments([
        ...comments,
        {
          id: row.id,
          text: row.text,
          author: row.author,
          created_at: row.created_at,
          position_x: row.position_x,
          position_y: row.position_y,
          mentions: row.mentions,
        },
      ]);
      setDraft("");
      setPendingPos(null);
      setMode(false);
      pushUiNotice({ type: "success", text: "Comentário adicionado." });
    } catch (err) {
      pushUiNotice({ type: "error", text: err instanceof Error ? err.message : "Falha" });
    }
  }

  return (
    <>
      <button
        type="button"
        className={`absolute left-3 top-3 z-20 rounded-lg border px-2 py-2 text-xs ${
          mode ? "border-[var(--accent)] bg-[var(--accent-muted)] text-indigo-100" : "border-[var(--border)] bg-black/40 text-slate-300"
        }`}
        onClick={() => setMode((v) => !v)}
        title="Comentários no canvas"
      >
        <MessageSquarePlus size={14} className="inline mr-1" />
        Comentar
      </button>

      <div
        className={mode ? "absolute inset-0 z-10 cursor-crosshair" : "pointer-events-none absolute inset-0 z-10"}
        onClick={onCanvasClick}
        aria-hidden={!mode}
      />

      {comments
        .filter((c) => c.position_x != null && c.position_y != null)
        .map((c) => (
          <CommentPin key={c.id} comment={c} />
        ))}

      {pendingPos && (
        <div
          className="canvas-comment-pin absolute z-30 w-56 rounded-xl border border-[var(--accent)]/40 bg-[var(--surface-1)] p-2 elev-3"
          style={{ left: pendingPos.x, top: pendingPos.y, transform: "translate(-50%, -100%)" }}
        >
          <textarea
            className="w-full rounded border border-[var(--border)] bg-black/30 px-2 py-1 text-xs text-slate-100"
            rows={3}
            placeholder="Comentário… use @email para mencionar"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="mt-1 flex gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={() => void submitComment()}>
              Salvar
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setPendingPos(null)}>
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CommentPin({ comment }: { comment: CanvasComment }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="canvas-comment-pin absolute z-20"
      style={{
        left: comment.position_x ?? 0,
        top: comment.position_y ?? 0,
        transform: "translate(-50%, -50%)",
      }}
    >
      <button
        type="button"
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm font-bold ${
          comment.resolved ? "border-slate-500 bg-slate-700 text-[var(--muted-fg)]" : "border-[var(--accent)] bg-[var(--accent)]/30 text-indigo-100"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        !
      </button>
      {open && (
        <div className="absolute left-8 top-0 w-52 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs text-slate-200 elev-2">
          <p className="text-sm text-[var(--muted)]">{comment.author}</p>
          <p className="mt-1">{comment.text}</p>
          {comment.assignee && <p className="mt-1 text-indigo-300">@{comment.assignee}</p>}
        </div>
      )}
    </div>
  );
}
