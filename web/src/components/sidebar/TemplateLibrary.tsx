"use client";

import { LayoutTemplate, Zap } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";

const FREE_TEMPLATES = [
  {
    id: "simple-flow" as const,
    title: "Fluxo simples",
    description: "Início → processo → fim, com setas.",
  },
  {
    id: "decision-tree" as const,
    title: "Árvore de decisão",
    description: "Decisão com ramificações sim/não.",
  },
  {
    id: "process" as const,
    title: "Processo",
    description: "Etapas sequenciais de um processo.",
  },
];

type Props = {
  /** When true, only show free templates (default). */
  freeOnly?: boolean;
};

/**
 * Pre-configured node sets for free diagrams (T9).
 */
export default function TemplateLibrary({ freeOnly = true }: Props) {
  const applyFreeTemplate = useGraphStore((s) => s.applyFreeTemplate);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const nodes = useGraphStore((s) => s.nodes);

  return (
    <div className="space-y-3 px-4 py-4" data-testid="template-library">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
          <LayoutTemplate size={14} aria-hidden />
          Biblioteca de templates
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted-fg)]">
          Aplique um kit pronto no canvas. {nodes.length > 0 ? "Substitui o conteúdo atual." : "Canvas vazio — ideal para começar."}
        </p>
      </div>

      {freeOnly && (
        <ul className="space-y-2">
          {FREE_TEMPLATES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2.5 text-left transition hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={() => {
                  applyFreeTemplate(t.id);
                  pushUiNotice({ type: "success", text: `Template “${t.title}” aplicado.` });
                }}
                aria-label={`Aplicar template ${t.title}`}
              >
                <Zap size={14} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-[var(--foreground)]">{t.title}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{t.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
