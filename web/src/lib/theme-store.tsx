"use client";

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light" | "high-contrast";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => undefined,
  setTheme: () => undefined,
  cycleTheme: () => undefined,
});

const THEME_ORDER: Theme[] = ["dark", "light", "high-contrast"];

function isTheme(v: string | null): v is Theme {
  return v === "dark" || v === "light" || v === "high-contrast";
}

function getInitialTheme(): Theme {
  return "dark";
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("archia-dark", "archia-light", "archia-high-contrast");
  root.classList.add(`archia-${theme}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    try {
      // Force dark theme always, ignore localStorage
      localStorage.setItem("archia-theme", "dark");
      setThemeState("dark");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem("archia-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : prev === "light" ? "dark" : "dark"));
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const i = THEME_ORDER.indexOf(prev);
      return THEME_ORDER[(i + 1) % THEME_ORDER.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
