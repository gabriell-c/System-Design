"use client";

import { useEffect, useState } from "react";
import type { ProjectNfr } from "@/lib/types";

interface TitleBlockProps {
  title: string;
  author?: string;
  version?: string;
  date?: string;
  provider?: string;
  classification?: string;
  nfr?: ProjectNfr | null;
  /** overlay = canvas UI; inline = dentro de export/composição */
  variant?: "overlay" | "inline";
  className?: string;
}

export default function TitleBlock({
  title,
  author = "Arquiteto",
  version = "1.0",
  date = new Date().toLocaleDateString("pt-BR"),
  provider,
  classification = "Confidencial — uso interno",
  nfr,
  variant = "overlay",
  className = "",
}: TitleBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (variant !== "overlay") return;
    const t = window.setTimeout(() => setCollapsed(true), 3000);
    return () => window.clearTimeout(t);
  }, [variant, title]);

  const shell =
    variant === "overlay"
      ? "bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg elev-3 p-3 text-xs pointer-events-auto"
      : "bg-[var(--surface-1)] border border-[var(--border)] rounded-lg p-3 text-xs";

  if (variant === "overlay" && collapsed) {
    return (
      <button
        type="button"
        className={`pointer-events-auto rounded-lg border border-zinc-700 bg-zinc-900/95 px-2.5 py-2 text-xs font-medium text-zinc-200 backdrop-blur elev-2 ${className}`}
        onClick={() => setCollapsed(false)}
        title="Mostrar bloco de título"
      >
        {title}
      </button>
    );
  }

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-100">{title}</p>
          <p className="mt-0.5 text-zinc-400">
            {author} · v{version} · {date}
          </p>
          {provider && <p className="mt-0.5 text-zinc-500">Provider: {provider}</p>}
          {classification && (
            <p className="mt-1 text-sm uppercase tracking-wide text-zinc-500">{classification}</p>
          )}
        </div>
        {nfr && (
          <div className="flex shrink-0 flex-col gap-2 text-right">
            {nfr.availability_pct != null && (
              <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                {nfr.availability_pct}%
              </span>
            )}
            {nfr.latency_p99_ms != null && (
              <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-400">
                p99 {nfr.latency_p99_ms}ms
              </span>
            )}
            {nfr.users_per_day != null && (
              <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-purple-400">
                ~{nfr.users_per_day}/dia
              </span>
            )}
          </div>
        )}
      </div>
      {variant === "overlay" && (
        <button
          type="button"
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
          onClick={() => setCollapsed(true)}
        >
          Recolher
        </button>
      )}
    </div>
  );
}
