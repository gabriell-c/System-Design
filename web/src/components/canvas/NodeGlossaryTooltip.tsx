"use client";

import { useMemo, useState } from "react";
import { findGlossaryTerm, type GlossaryTerm } from "@/lib/glossary";

interface Props {
  nodeId: string;
  nodeLabel: string;
  nodeTech?: string;
  children: React.ReactNode;
}

/**
 * P3.1.3 — Tooltip de glossário ao hover em nós do canvas.
 */
export default function NodeGlossaryTooltip({ nodeId, nodeLabel, nodeTech, children }: Props) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const term = useMemo(() => findGlossaryTerm(nodeId) ?? findGlossaryTerm(nodeLabel), [nodeId, nodeLabel]);

  if (!term) {
    return <>{children}</>;
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPosition({ x: rect.right + 8, y: rect.top });
    setShow(true);
  };

  const handleMouseLeave = () => setShow(false);

  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ display: "inline-block" }}>
        {children}
      </div>
      {show && (
        <div
          className="fixed z-50 w-72 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)]/95 p-3 text-xs text-slate-200 elev-4 backdrop-blur"
          style={{ left: Math.min(position.x, window.innerWidth - 300), top: position.y }}
          role="tooltip"
          aria-label={`Glossário: ${term.term}`}
        >
          <div className="flex items-start justify-between">
            <p className="font-semibold text-indigo-300">{term.term}</p>
            <span className="rounded bg-white/10 px-2 py-0.5 text-sm text-[var(--muted-fg)]">
              {term.category}
            </span>
          </div>
          <p className="mt-2 text-slate-300">{term.definition}</p>
          {term.related && term.related.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {term.related.map((r) => (
                <span key={r} className="rounded bg-violet-500/20 px-2 py-0.5 text-sm text-violet-200">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
