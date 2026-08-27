"use client";

import type { FreeShadow } from "@/lib/types";

const OPTIONS: { id: FreeShadow; label: string; preview: string }[] = [
  { id: "none", label: "Nenhuma", preview: "shadow-none" },
  { id: "sm", label: "Pequena", preview: "shadow-sm" },
  { id: "md", label: "Média", preview: "shadow-md" },
  { id: "lg", label: "Grande", preview: "shadow-lg" },
  { id: "xl", label: "Extra", preview: "shadow-xl" },
];

type Props = {
  value: FreeShadow;
  onChange: (value: FreeShadow) => void;
};

export default function NodeShadowPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-fg)] mb-1.5">Sombra</p>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.label}
            aria-pressed={value === opt.id}
            className={`h-8 w-10 rounded border bg-[var(--surface-2)] ${opt.preview} ${
              value === opt.id
                ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/50"
                : "border-[var(--border)]"
            }`}
            onClick={() => onChange(opt.id)}
          />
        ))}
      </div>
    </div>
  );
}
