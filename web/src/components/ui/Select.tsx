"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { moveHighlight } from "@/lib/select-nav";

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

/**
 * S3b (item 69, CRÍTICO) — navegação por teclado que realmente funciona:
 * - ao abrir, o listbox recebe focus (`listboxRef.current?.focus()`);
 *   antes, o listbox tinha `tabIndex={-1}` e NUNCA recebia focus →
 *   ArrowUp/Down/Enter eram inalcançáveis.
 * - ao fechar, se o foco ainda está DENTRO do widget (listbox/opção), ele
 *   volta para o trigger — sem roubar focus em fechamento por clique
 *   fora (activeElement já está fora).
 * - as teclas de navegação vivem no listbox (que tem o focus); o trigger
 *   só abre e, se já estiver aberto, delega as setas para navegar.
 * - a matemática do clamp fica em `@/lib/select-nav` (pura, testada em
 *   `select.test.ts` com node:test — ruling: sem RTL, testa-se o cálculo).
 */
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
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

  // S3b (item 69): focus do listbox ao abrir / devolução ao trigger ao fechar.
  useEffect(() => {
    if (!open) {
      // Só devolve o focus se ele ainda estiver no widget (Escape/Enter).
      // Fechamento por clique fora: activeElement já está fora → não rouba.
      if (typeof document !== "undefined" && ref.current?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
      return;
    }
    listboxRef.current?.focus();
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

  function navigate(dir: 1 | -1) {
    setHighlight((h) => moveHighlight(h, dir, items.length));
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-left text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition focus:border-[var(--accent)]/50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openList();
            else navigate(e.key === "ArrowUp" ? -1 : 1);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            // Aberto e foco no trigger: Enter seleciona o item em highlight.
            if (open) selectAt(highlight);
            else openList();
          }
        }}
      >
        <span className={selected ? "" : "text-[var(--muted)]"}>
          {selected?.label ?? placeholder ?? "Selecione"}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={listboxRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`select-opt-${listId}-${highlight}`}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1 elev-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              navigate(1);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              navigate(-1);
              return;
            }
            if (e.key === "Enter" || e.key === " ") {
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
                id={`select-opt-${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  focused || active ? "bg-[var(--accent-muted)] text-indigo-200" : "text-slate-200 hover:bg-white/5"
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => selectAt(index)}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {active && <Check size={14} className="shrink-0 text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
