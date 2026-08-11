"use client";

import type { ReactNode } from "react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export default function Toggle({ checked, onChange, label, disabled, className }: Props) {
  return (
    <label
      className={`flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer text-slate-200 hover:bg-white/[0.03]"
      } ${className ?? ""}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-cyan-500" : "bg-slate-700"
        }`}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
      {label}
    </label>
  );
}
