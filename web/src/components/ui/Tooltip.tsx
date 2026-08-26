"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
};

/**
 * Lightweight tooltip (no Radix dependency). Prefer short labels (≤5 words).
 */
export default function Tooltip({ content, children, side = "bottom", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const pos =
    side === "top"
      ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
      : side === "left"
        ? "right-full top-1/2 mr-1.5 -translate-y-1/2"
        : side === "right"
          ? "left-full top-1/2 ml-1.5 -translate-y-1/2"
          : "top-full left-1/2 mt-1.5 -translate-x-1/2";

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && content && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-[80] whitespace-nowrap rounded-md border border-[var(--border-strong)] bg-[var(--surface-3)] px-2 py-1 text-sm font-medium text-[var(--foreground)] elev-2 ${pos}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
