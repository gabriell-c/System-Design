"use client";

import type { FreeFillPattern } from "@/lib/types";

const OPTIONS: { id: FreeFillPattern; label: string }[] = [
  { id: "none", label: "Nenhum" },
  { id: "stripes", label: "Listras" },
  { id: "dots", label: "Pontos" },
  { id: "checker", label: "Xadrez" },
];

type Props = {
  value: FreeFillPattern;
  onChange: (value: FreeFillPattern) => void;
};

export default function NodeFillPatternPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-fg)] mb-1.5">Padrão de preenchimento</p>
      <div className="grid grid-cols-4 gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.label}
            aria-pressed={value === opt.id}
            className={`rounded border px-1 py-1.5 text-xs ${
              value === opt.id
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted-fg)]"
            }`}
            style={
              opt.id !== "none"
                ? { backgroundImage: fillPatternCss(opt.id), backgroundSize: "8px 8px" }
                : undefined
            }
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Inline SVG data-URI patterns for free-node fills. */
export function fillPatternCss(pattern: FreeFillPattern): string | undefined {
  if (pattern === "none") return undefined;
  const enc = encodeURIComponent;
  if (pattern === "stripes") {
    return `url("data:image/svg+xml,${enc(
      `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2' stroke='rgba(255,255,255,0.25)' stroke-width='1'/></svg>`
    )}")`;
  }
  if (pattern === "dots") {
    return `url("data:image/svg+xml,${enc(
      `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='2' cy='2' r='1' fill='rgba(255,255,255,0.3)'/></svg>`
    )}")`;
  }
  return `url("data:image/svg+xml,${enc(
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='4' height='4' fill='rgba(255,255,255,0.15)'/><rect x='4' y='4' width='4' height='4' fill='rgba(255,255,255,0.15)'/></svg>`
  )}")`;
}
