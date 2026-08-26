"use client";

import { ArrowLeft, Command, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFoundPage() {
  const [countdown, setCountdown] = useState(10);
  const [isDark, setIsDark] = useState(true); // Default matches SSR

  useEffect(() => {
    // Theme is already applied by layout.tsx inline script before React hydrates
    // No need to read localStorage here to avoid hydration mismatch

    const timer = setTimeout(() => {
      window.location.href = "/";
    }, 10000);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[var(--background)]" : "bg-slate-50"}`}>
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/4 -left-32 h-96 w-96 rounded-full blur-3xl ${isDark ? "bg-indigo-500/10" : "bg-indigo-200/50"}`} />
        <div className={`absolute bottom-1/4 -right-32 h-96 w-96 rounded-full blur-3xl ${isDark ? "bg-purple-500/10" : "bg-purple-200/50"}`} />
      </div>

      <div className="relative z-10 mx-4 max-w-lg text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${isDark ? "bg-gradient-to-br from-indigo-400 to-indigo-600" : "bg-gradient-to-br from-indigo-500 to-indigo-700"} elev-3`}>
            <Command className={`h-8 w-8 ${isDark ? "text-slate-950" : "text-white"}`} />
          </div>
        </div>

        {/* 404 Number */}
        <h1 className={`mb-2 text-9xl font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
          404
        </h1>

        {/* Subtitle */}
        <h2 className={`mb-3 text-2xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          Página não encontrada
        </h2>

        <p className={`mb-8 text-base leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          Parece que esta página foi para um diagrama não mapeado.<br />
          Vamos voltar para a segurança do dashboard.
        </p>

        {/* Action buttons */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className={`group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-medium transition-all ${
              isDark
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            <Home className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            Voltar ao início
          </Link>

          <button
            onClick={() => window.location.reload()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3 font-medium transition-all ${
              isDark
                ? "border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800/50"
                : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <RefreshCw className="h-4 w-4 transition-transform hover:rotate-180" />
            Recarregar
          </button>
        </div>

        {/* Countdown hint */}
        <div className={`mx-auto flex max-w-xs items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
          isDark ? "border-slate-800 bg-slate-900/50 text-slate-500" : "border-slate-200 bg-slate-50 text-slate-500"
        }`}>
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>
            Redirecionando em {countdown}s
          </span>
          <Link
            href="/"
            className={`ml-auto flex items-center gap-1 text-xs transition-colors ${
              isDark ? "text-slate-400 hover:text-indigo-400" : "text-slate-500 hover:text-indigo-600"
            }`}
          >
            <ArrowLeft className="h-3 w-3" />
            Agora
          </Link>
        </div>

        {/* Help text */}
        <p className={`mt-6 text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
          Se o problema persistir, verifique a URL ou entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}
