"use client";

import { useId, useState } from "react";

const PRESETS = [
  "#1e293b",
  "#0f172a",
  "#312e81",
  "#1e3a5f",
  "#14532d",
  "#7c2d12",
  "#fef08a",
  "#f1f5f9",
  "#6366f1",
  "#34d399",
  "#f43f5e",
  "#38bdf8",
];

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

/**
 * Enhanced color picker for free-node customization (T8).
 * Native color input + hex field + preset swatches.
 */
export default function NodeColorPicker({ label, value, onChange }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const hex = value.startsWith("#") ? value : "#1e293b";

  return (
    <div className="relative">
      <label className="text-xs text-[var(--muted-fg)]" htmlFor={id}>
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          id={id}
          className="h-7 w-8 shrink-0 rounded border border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ backgroundColor: hex }}
          aria-label={`${label}: ${hex}. Abrir seletor`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        />
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label={`${label} hex`}
        />
      </div>
      {open && (
        <div
          className="absolute left-0 z-30 mt-2 grid w-44 grid-cols-6 gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-2 elev-3"
          role="listbox"
          aria-label={`Presets de ${label}`}
        >
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={hex.toLowerCase() === c.toLowerCase()}
              className="h-6 w-6 rounded border border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={{ backgroundColor: c }}
              title={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <label className="col-span-6 mt-1 flex cursor-pointer items-center gap-2 text-[10px] text-[var(--muted)]">
            <input
              type="color"
              value={hex}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-full cursor-pointer"
            />
            Personalizar
          </label>
        </div>
      )}
    </div>
  );
}
