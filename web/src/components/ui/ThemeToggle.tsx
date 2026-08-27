"use client";

import { Sun, Moon, Contrast } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme-store";

const LABELS: Record<Theme, string> = {
  dark: "Escuro",
  light: "Claro",
  "high-contrast": "Alto contraste",
};

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const nextHint =
    theme === "dark" ? "Ativar modo claro" : theme === "light" ? "Ativar alto contraste" : "Ativar modo escuro";

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-2 text-[12px] font-medium text-[var(--muted-fg)] transition hover:border-[var(--border-strong)] hover:text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      title={nextHint}
      aria-label={nextHint}
      data-testid="theme-toggle"
    >
      {theme === "dark" ? (
        <Sun size={14} className="text-amber-400" aria-hidden />
      ) : theme === "light" ? (
        <Contrast size={14} className="text-indigo-400" aria-hidden />
      ) : (
        <Moon size={14} className="text-slate-200" aria-hidden />
      )}
      <span className="hidden sm:inline">{LABELS[theme]}</span>
    </button>
  );
}
