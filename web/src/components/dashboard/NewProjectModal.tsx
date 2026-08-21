"use client";

import AccessSettings from "@/components/dashboard/AccessSettings";
import type { ProjectAccessEntry } from "@/lib/types";
import {
  AlertCircle,
  Eye,
  FileText,
  FolderPlus,
  Globe2,
  Loader2,
  Lock,
  Save,
  Type,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    is_public: boolean;
    access_list: ProjectAccessEntry[];
  }) => Promise<void>;
};

export default function NewProjectModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [accessList, setAccessList] = useState<ProjectAccessEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setIsPublic(false);
    setAccessList([]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome do projeto");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        is_public: isPublic,
        access_list: accessList,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar projeto");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--surface-2)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
              <FolderPlus className="h-4 w-4" />
            </span>
            <h2 id="new-project-title" className="text-lg font-semibold text-slate-100">
              Novo projeto
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Type className="h-3.5 w-3.5" />
              Nome
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Checkout multi-região"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <FileText className="h-3.5 w-3.5" />
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contexto breve da arquitetura…"
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="rounded-xl border border-white/8 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {isPublic ? (
                  <Globe2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                ) : (
                  <Lock className="mt-0.5 h-4 w-4 text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-200">Visibilidade</p>
                  <p className="text-[11px] text-slate-500">
                    Público gera URL de compartilhamento (somente leitura)
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition ${
                  isPublic ? "bg-[var(--accent)]" : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition ${
                    isPublic ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              {isPublic ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> Projeto público
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" /> Projeto privado
                </>
              )}
            </p>
          </div>

          <AccessSettings value={accessList} onChange={setAccessList} />

          {error && (
            <p className="inline-flex items-center gap-1.5 text-sm text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-white/8 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Criando…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Criar projeto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
