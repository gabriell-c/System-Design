"use client";

import SidebarNav from "./SidebarNav";
import { useProjectStore } from "@/lib/project-store";
import { useState, useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  // Load projects once
  useEffect(() => {
    const loadProjects = async () => {
      try {
        await useProjectStore.getState().loadProjects();
      } finally {
        setIsLoading(false);
      }
    };
    void loadProjects();
  }, []);

  if (isLoading) {
    // Loading state — show spinner while projects load
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "#060913" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
      </div>
    );
  }

  // Sempre usar a MESMA sidebar em TODAS as páginas
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <SidebarNav />
      <main id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
