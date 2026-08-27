"use client";

import { useEffect, useRef } from "react";

interface MermaidViewerProps {
  code: string;
  className?: string;
}

export default function MermaidViewer({ code, className = "" }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    const loadAndRender = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
        });

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Mermaid render error:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre style="color: var(--muted-fg); padding: 1rem;">${code}</pre>`;
        }
      }
    };

    loadAndRender();
  }, [code]);

  return (
    <div
      ref={containerRef}
      className={className}
      suppressHydrationWarning
    />
  );
}
