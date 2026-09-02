"use client";

/**
 * Diagrama Livre = Excalidraw oficial, sem chrome Archia.
 * API mínima da lib — igual ao exemplo dos docs.
 */
import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useGraphStore } from "@/lib/graph-store";
import { useCallback, useEffect, useRef, useState } from "react";

function elementsFingerprint(elements: readonly ExcalidrawElement[]): string {
  let h = 2166136261;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  mix(String(elements.length));
  for (const el of elements) {
    mix(el.id);
    mix(el.type);
    mix(String(el.version ?? 0));
    mix(String(el.versionNonce ?? 0));
    mix(String(el.isDeleted ? 1 : 0));
    mix(String(Math.round(el.x)));
    mix(String(Math.round(el.y)));
    mix(String(Math.round(el.width)));
    mix(String(Math.round(el.height)));
    mix(String(el.updated ?? 0));
  }
  return (h >>> 0).toString(36);
}

function hideSocialLinks() {
  // Hide "Excalidraw links" section and social items
  document.querySelectorAll<HTMLElement>('[class*="dropdown-menu-group"]').forEach((group) => {
    const title = group.querySelector<HTMLElement>('[class*="dropdown-menu-group-title"]');
    if (title && title.textContent?.includes("Excalidraw")) {
      group.style.display = "none";
    }
  });
  document.querySelectorAll<HTMLElement>('[aria-label="GitHub"], [title="GitHub"], [aria-label="Discord"], [title="Discord"]').forEach((el) => {
    if (el.parentElement) el.parentElement.style.display = "none";
  });
  document.querySelectorAll<HTMLElement>('[class*="dropdown-menu-item"]').forEach((item) => {
    const text = item.textContent?.trim() || "";
    if (text === "GitHub" || text === "Discord" || text === "Follow us") {
      item.style.display = "none";
    }
  });
}

export default function ExcalidrawWrapper() {
  const elements = useGraphStore((s) => s.excalidrawElements ?? []);
  const setElements = useGraphStore((s) => s.setExcalidrawElements);
  const lastFpRef = useRef(elementsFingerprint(elements));
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const initialDataRef = useRef({
    elements: elements as ExcalidrawElement[],
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const ro = new ResizeObserver(() => {
      if (check()) ro.disconnect();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onChange = useCallback(
    (next: readonly ExcalidrawElement[]) => {
      const fp = elementsFingerprint(next);
      if (fp === lastFpRef.current) return;
      lastFpRef.current = fp;
      setElements([...next]);
    },
    [setElements],
  );

  // Hide social links when menu opens
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTimeout(hideSocialLinks, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    hideSocialLinks();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="excalidraw-container"
      style={{ height: "100%", width: "100%" }}
    >
      {ready ? (
        <Excalidraw
          initialData={initialDataRef.current}
          onChange={onChange}
          langCode="pt-BR"
          theme="light"
        />
      ) : null}
    </div>
  );
}
