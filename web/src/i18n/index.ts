"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Translations = Record<string, string | Record<string, string>>;

/** Locales that use right-to-left script (manual §14). */
export const RTL_LOCALES = new Set(["ar", "ar-SA", "he", "he-IL", "fa", "fa-IR", "ur", "ur-PK"]);

export function isRtlLocale(locale: string): boolean {
  if (RTL_LOCALES.has(locale)) return true;
  const base = locale.split("-")[0]?.toLowerCase() ?? "";
  return RTL_LOCALES.has(base);
}

function getString(obj: Translations, key: string): string {
  const parts = key.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return key;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : key;
}

interface I18nCtx {
  t: (key: string) => string;
  locale: string;
  setLocale: (l: string) => void;
  dir: "ltr" | "rtl";
  isRtl: boolean;
}

const C = createContext<I18nCtx>({
  t: (k) => k,
  locale: "pt-BR",
  setLocale: () => {},
  dir: "ltr",
  isRtl: false,
});

type Props = {
  children: React.ReactNode;
  locale?: string;
  translations: Translations;
};

const LOCALE_KEY = "archia-locale";

export function I18nProvider(props: Props) {
  const [currentLocale, setCurrentLocale] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCALE_KEY);
        if (saved) return saved;
      } catch {
        /* ignore */
      }
    }
    return props.locale ?? "pt-BR";
  });

  const t = useCallback(
    (key: string) => getString(props.translations, key),
    [props.translations],
  );

  const setLocale = useCallback((l: string) => {
    setCurrentLocale(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const isRtl = isRtlLocale(currentLocale);
  const dir: "ltr" | "rtl" = isRtl ? "rtl" : "ltr";

  useEffect(() => {
    const html = document.documentElement;
    html.lang = currentLocale;
    html.dir = dir;
    html.classList.toggle("archia-rtl", isRtl);
    html.classList.toggle("archia-ltr", !isRtl);
  }, [currentLocale, dir, isRtl]);

  const ctx: I18nCtx = { t, locale: currentLocale, setLocale, dir, isRtl };
  return React.createElement(C.Provider, { value: ctx }, props.children);
}

export function useTranslation() {
  return useContext(C);
}
