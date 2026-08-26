"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type Translations = Record<string, string | Record<string, string>>;

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
}

const C = createContext<I18nCtx>({ t: (k) => k, locale: "pt-BR", setLocale: () => {} });

type Props = {
  children: React.ReactNode;
  locale?: string;
  translations: Translations;
};

export function I18nProvider(props: Props) {
  const [currentLocale, setCurrentLocale] = useState(props.locale ?? "pt-BR");
  const t = useCallback((key: string) => getString(props.translations, key), [props.translations]);
  const ctx = { t, locale: currentLocale, setLocale: setCurrentLocale };
  return React.createElement(C.Provider, { value: ctx }, props.children);
}

export function useTranslation() {
  return useContext(C);
}
