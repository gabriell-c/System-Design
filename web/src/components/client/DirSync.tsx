"use client";

import { useEffect } from "react";
import { useTranslation, isRtlLocale } from "@/i18n";

/** Syncs `dir` / `lang` on <html> when locale changes (RTL support). */
export default function DirSync() {
  const { locale } = useTranslation();

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = isRtlLocale(locale) ? "rtl" : "ltr";
    html.classList.toggle("archia-rtl", isRtlLocale(locale));
    html.classList.toggle("archia-ltr", !isRtlLocale(locale));
  }, [locale]);

  return null;
}
