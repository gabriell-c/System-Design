"use client";

import type { LucideIcon } from "lucide-react";

type PanelHeaderProps = {
  /** Ícone lucide exibido no chip colorido. */
  icon: LucideIcon;
  /** Classes do chip (fundo/ícone). Ex.: "bg-emerald-500/15 text-emerald-300". */
  chipClass: string;
  title: string;
  subtitle: React.ReactNode;
};

/**
 * Cabeçalho padrão dos painéis: chip de ícone + título + subtítulo.
 * (P4 — extraído da duplicação em 12 painéis; ver panels/*.tsx)
 */
export default function PanelHeader({ icon: Icon, chipClass, title, subtitle }: PanelHeaderProps) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${chipClass}`}>
        <Icon size={16} aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-fg)]">{subtitle}</p>
      </div>
    </div>
  );
}
