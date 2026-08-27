"use client";

import { Grid3x3, Magnet, MousePointer2 } from "lucide-react";
import TemplateLibrary from "@/components/sidebar/TemplateLibrary";

export default function FreeCanvasSettings() {
  return (
    <div className="space-y-4">
      <div className="space-y-4 px-4 pt-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">Preferências do canvas</p>
          <p className="mt-0.5 text-xs text-[var(--muted-fg)]">
            Diagrama livre — foco em ideias visuais, sem análise de arquitetura.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-[var(--muted)]">
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-black/20 p-3">
            <MousePointer2 size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
            <span>
              Clique num elemento e use <strong className="text-slate-200">Props</strong> para cores,
              notas, links e camada. Shift+arrastar seleciona vários.
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-black/20 p-3">
            <Magnet size={16} className="mt-0.5 shrink-0 text-indigo-300" aria-hidden />
            <span>
              Segure <kbd className="rounded bg-white/10 px-1">Shift</kbd> ao redimensionar para
              manter proporção.
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-black/20 p-3">
            <Grid3x3 size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
            <span>
              Elementos novos aparecem automaticamente na frente. Use Camada nas props para
              reordenar.
            </span>
          </li>
        </ul>

        <p className="text-xs text-[var(--muted-fg)]">
          Ctrl+Z desfaz · Shift+Z refaz · Delete remove seleção · Ctrl+0 encaixa na tela
        </p>
      </div>

      <div className="border-t border-[var(--border)]">
        <TemplateLibrary />
      </div>
    </div>
  );
}
