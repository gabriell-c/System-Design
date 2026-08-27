"use client";

import { ChevronDown, ChevronUp, PanelTop } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "archia-canvas-toolbar-collapsed";

type Props = {
  children: ReactNode;
  /** Extra actions on the right of the collapse control */
  trailing?: ReactNode;
  className?: string;
  label?: string;
};

/**
 * Sticky, collapsible canvas toolbar (T1).
 * Persists collapsed state in localStorage.
 */
export default function Toolbar({
  children,
  trailing,
  className = "",
  label = "Barra de ferramentas do canvas",
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      className={`sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur ${className}`}
      role="toolbar"
      aria-label={label}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="flex h-10 items-center gap-2 px-2">
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 px-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="canvas-toolbar-body"
          aria-label={collapsed ? "Expandir barra de ferramentas" : "Recolher barra de ferramentas"}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <PanelTop size={14} aria-hidden />
          {collapsed ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
          <span className="hidden sm:inline">{collapsed ? "Ferramentas" : "Recolher"}</span>
        </button>
        {!collapsed && (
          <div id="canvas-toolbar-body" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {children}
          </div>
        )}
        {collapsed && <div className="flex-1" />}
        {trailing}
      </div>
    </div>
  );
}
