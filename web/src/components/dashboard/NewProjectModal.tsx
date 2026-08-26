"use client";

import AccessSettings from "@/components/dashboard/AccessSettings";
import type { ProjectAccessEntry, ProjectKind } from "@/lib/types";
import {
  AlertCircle,
  FileText,
  FolderPlus,
  Globe2,
  LayoutGrid,
  Loader2,
  Lock,
  PenTool,
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
    project_kind: ProjectKind;
    access_list: ProjectAccessEntry[];
  }) => Promise<void>;
};

const PROJECT_KIND_OPTIONS: Array<{
  kind: ProjectKind;
  title: string;
  description: string;
  icon: typeof LayoutGrid;
}> = [
  {
    kind: "architecture",
    title: "Diagrama de Arquitetura",
    description: "Zonas VPC, AZ, fluxos tipados, análise de IA",
    icon: LayoutGrid,
  },
  {
    kind: "free",
    title: "Diagrama Livre",
    description: "Formas livres, setas, cards — para ideias e fluxos",
    icon: PenTool,
  },
];

export default function NewProjectModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectKind, setProjectKind] = useState<ProjectKind>("architecture");
  const [isPublic, setIsPublic] = useState(false);
  const [accessList, setAccessList] = useState<ProjectAccessEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDescription("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectKind("architecture");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPublic(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccessList([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        project_kind: projectKind,
        access_list: accessList,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar projeto");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] elev-4"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
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
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-white/5 hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--muted-fg)]">Tipo de diagrama</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROJECT_KIND_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = projectKind === option.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => setProjectKind(option.kind)}
                    className={`rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-muted)]/40"
                        : "border-[var(--border)] bg-black/20 hover:border-[var(--accent)]/30"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          selected
                            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                            : "bg-[var(--surface-3)] text-[var(--muted-fg)]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-medium text-slate-100">{option.title}</span>
                    </div>
                    <p className="text-xs leading-snug text-[var(--muted-fg)]">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-fg)]">
              <Type className="h-3.5 w-3.5" />
              Nome
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Checkout multi-região"
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-[var(--muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-fg)]">
              <FileText className="h-3.5 w-3.5" />
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={projectKind === "free" ? "Contexto breve da ideia…" : "Contexto breve da arquitetura…"}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-[var(--muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Lock className="h-4 w-4 text-[var(--muted)]" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-200">Visibilidade</p>
                  <p className="text-xs text-[var(--muted-fg)]">
                    {isPublic ? "Público — gera URL de compartilhamento" : "Privado — somente você acessa"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition ${
                  isPublic ? "bg-[var(--accent)]" : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition ${
                    isPublic ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <AccessSettings value={accessList} onChange={setAccessList} />
          </div>

          {error && (
            <p className="inline-flex items-center gap-1.5 text-sm text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-[var(--muted-fg)] hover:bg-white/5 hover:text-slate-200"
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
