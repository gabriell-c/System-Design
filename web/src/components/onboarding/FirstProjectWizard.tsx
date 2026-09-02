"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderPlus,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete: (data: { name: string; description: string; context: string }) => Promise<string | void>;
};

const STEPS = [
  { id: 1, title: "Nome", icon: Type },
  { id: 2, title: "Contexto", icon: FileText },
  { id: 3, title: "Pronto", icon: Sparkles },
] as const;

export default function FirstProjectWizard({ open, onClose, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1);
     
    setName("");
     
    setDescription("");
     
    setContext("");
     
    setError(null);
     
    setSubmitting(false);
     
    setSuccess(false);
  }, [open]);

  if (!open) return null;

  function markOnboarded() {
    try {
      localStorage.setItem("archia-onboarded", "1");
    } catch {
      /* ignore */
    }
  }

  function skip() {
    markOnboarded();
    onClose();
  }

  async function finish() {
    if (!name.trim()) {
      setError("Informe o nome do projeto");
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const projectId = await onComplete({
        name: name.trim(),
        description: description.trim(),
        context: context.trim(),
      });
      markOnboarded();
      setSuccess(true);
      setSubmitting(false);
      window.setTimeout(() => {
        if (projectId) router.push(`/project/${projectId}`);
        else onClose();
      }, 1400);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Verifique a conexão e tente novamente.`
          : "Falha ao criar projeto. Verifique a conexão e tente novamente.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] elev-4"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]">
              <FolderPlus className="h-4 w-4" />
            </span>
            <div>
              <h2 id="wizard-title" className="text-base font-semibold text-[var(--foreground)]">
                Seu primeiro projeto
              </h2>
              <p className="text-[12px] text-[var(--muted)]">Passo a passo — 3 minutos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={skip}
              className="rounded-lg px-2.5 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={skip}
              className="rounded-lg p-2 text-[var(--muted-fg)] hover:bg-white/5 hover:text-[var(--foreground)]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-[var(--border)] px-5 py-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div
                key={s.id}
                className={`flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium ${
                  active
                    ? "bg-[var(--accent-muted)] text-indigo-200"
                    : done
                      ? "text-emerald-300"
                      : "text-[var(--muted-fg)]"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">
                  {s.id}. {s.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="min-h-[220px] space-y-4 px-5 py-5">
          {success ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <p className="text-lg font-semibold text-[var(--foreground)]">Projeto criado com sucesso!</p>
              <p className="panel-hint prose-measure">Abrindo o editor para você começar a desenhar…</p>
            </div>
          ) : (
            <>
          {step === 1 && (
            <>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Dê um nome ao seu projeto</p>
                <p className="panel-hint mt-1">Algo curto que a equipe reconheça.</p>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--muted)]">
                  <Type className="h-3.5 w-3.5" />
                  Nome
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Checkout multi-região"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
                  Descrição (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Uma linha de contexto…"
                  className="w-full resize-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)]"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Qual é o objetivo desta arquitetura?
                </p>
                <p className="panel-hint mt-1">
                  Usuários, carga, restrições — ajuda a IA a avaliar melhor.
                </p>
              </div>
              <textarea
                autoFocus
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={6}
                placeholder="Ex.: SaaS B2B com 50k usuários/dia, latência p99 abaixo de 200ms, orçamento ~US$2k/mês…"
                className="w-full resize-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)]"
              />
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--foreground)]">{name || "Seu projeto"}</p>
                <p className="panel-hint mt-1 max-w-sm">
                  Arraste blocos da paleta para o canvas, conecte e rode a análise quando estiver pronto.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-rose-300">{error}</p>}
            </>
          )}
        </div>

        {!success && (
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            disabled={step === 1 || submitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !name.trim()) {
                  setError("Informe o nome do projeto");
                  return;
                }
                setError(null);
                setStep((s) => s + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finish()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {submitting ? "Criando…" : "Começar a desenhar"}
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
