"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  side: "left" | "right";
  children: React.ReactNode;
};

export default function ResizablePanel({
  storageKey,
  defaultWidth,
  minWidth = 180,
  maxWidth = 600,
  side,
  children,
}: Props) {
  const [width, setWidth] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= minWidth && n <= maxWidth) return n;
      }
    } catch {
      /* ignore */
    }
    return defaultWidth;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const saveWidth = useCallback(
    (w: number) => {
      setWidth(w);
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  // listeners globais durante drag
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = side === "left" ? e.clientX - startX.current : startX.current - e.clientX;
      const next = Math.round(Math.min(maxWidth, Math.max(minWidth, startW.current + delta)));
      saveWidth(next);
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [side, minWidth, maxWidth, saveWidth]);

  return (
    <div
      className="flex h-full shrink-0"
      style={{ width, minWidth, maxWidth }}
    >
      {side === "right" && (
        <div
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-white/5 bg-transparent hover:bg-cyan-500/10"
          onMouseDown={(e) => {
            dragging.current = true;
            startX.current = e.clientX;
            startW.current = width;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        >
          <GripVertical
            size={10}
            className="text-slate-600 group-hover:text-cyan-400"
          />
        </div>
      )}
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      {side === "left" && (
        <div
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center border-r border-white/5 bg-transparent hover:bg-cyan-500/10"
          onMouseDown={(e) => {
            dragging.current = true;
            startX.current = e.clientX;
            startW.current = width;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        >
          <GripVertical
            size={10}
            className="text-slate-600 group-hover:text-cyan-400"
          />
        </div>
      )}
    </div>
  );
}
