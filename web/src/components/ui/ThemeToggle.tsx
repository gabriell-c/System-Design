"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-store";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-2 text-[12px] font-medium text-[var(--muted-fg)] transition hover:border-[var(--border-strong)] hover:text-slate-200 hover:bg-white/10"
      title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {theme === "dark" ? (
        <>
          <Sun size={14} className="text-amber-400" />
          <span className="hidden sm:inline">Claro</span>
        </>
      ) : (
        <>
          <Moon size={14} className="text-indigo-400" />
          <span className="hidden sm:inline">Escuro</span>
        </>
      )}
    </button>
  );
}
