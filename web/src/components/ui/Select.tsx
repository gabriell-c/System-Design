"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string };

type Props = {
  value: string;
  options: (string | Option)[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function normalize(opt: string | Option): Option {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const items = options.map(normalize);
  const selected = items.find((i) => i.value === value);
  const selectedIndex = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function openList() {
    setHighlight(selectedIndex);
    setOpen(true);
  }

  function selectAt(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.value);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-left text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openList();
          }
        }}
      >
        <span className={selected ? "" : "text-slate-500"}>
          {selected?.label ?? placeholder ?? "Selecione"}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#121821] p-1 shadow-2xl outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(items.length - 1, h + 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              selectAt(highlight);
            }
          }}
        >
          {items.map((item, index) => {
            const active = item.value === value;
            const focused = index === highlight;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  focused || active ? "bg-cyan-500/15 text-cyan-200" : "text-slate-200 hover:bg-white/5"
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => selectAt(index)}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {active && <Check size={14} className="shrink-0 text-cyan-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
