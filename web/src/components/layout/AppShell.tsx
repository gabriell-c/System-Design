"use client";

import SidebarNav from "./SidebarNav";
import { usePathname } from "next/navigation";
import { useProjectStore } from "@/lib/project-store";
import { useMemo, useState, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFreeProject, setIsFreeProject] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if current project is free
  useEffect(() => {
    const match = pathname.match(/^\/project\/([^/]+)/);
    if (!match) {
      setIsFreeProject(false);
      setIsLoading(false);
      return;
    }
    const projectId = match[1];
    const project = projects.find((p) => p.id === projectId);
    console.log("[AppShell] Finding project:", { projectId, projectsCount: projects.length, found: project?.id, kind: project?.project_kind });
    setIsFreeProject(project?.project_kind === "free");
    setIsLoading(false);
  }, [pathname, projects]);

  // Also check activeProjectId
  useEffect(() => {
    if (!activeProjectId) return;
    const project = projects.find((p) => p.id === activeProjectId);
    if (project) {
      setIsFreeProject(project.project_kind === "free");
    }
  }, [activeProjectId, projects]);

  if (isLoading) {
    // Loading state — show spinner while projects load
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "#ffffff" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  if (isFreeProject) {
    // Diagrama Livre: tela cheia com Excalidraw — sidebar com botão na borda
    return (
      <div className="relative flex h-screen w-screen overflow-hidden" style={{ background: "#ffffff" }}>
        {/* Sidebar lateral — 100% da altura, botão de toggle na borda esquerda */}
        <div
          className={`relative z-40 flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-1)] transition-[width,transform] duration-200 ${
            sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full overflow-hidden"
          }`}
        >
          {/* Conteúdo da sidebar — padding-left para o botão não cobrir */}
          <div className="flex-1 overflow-y-auto pl-7">
            <SidebarNav forceExpanded />
          </div>
        </div>

        {/* Botão de toggle — fixo na borda, desliza com a sidebar */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-0 top-1/2 z-50 flex h-10 w-7 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-[var(--border)] bg-[var(--surface-1)] text-[var(--muted-fg)] shadow-lg hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] transition-all"
          style={{
            transform: sidebarOpen
              ? "translateY(-50%) translateX(0)"
              : "translateY(-50%) translateX(-50%)",
          }}
          title={sidebarOpen ? "Fechar menu" : "Abrir menu"}
        >
          {sidebarOpen ? (
            <PanelLeftClose size={14} className="mr-0.5" />
          ) : (
            <PanelLeftOpen size={14} className="ml-0.5" />
          )}
        </button>

        {/* Canvas — Excalidraw ocupa todo o espaço restante */}
        <main id="main-content" className="relative flex-1 min-w-0 h-full">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <SidebarNav />
      <main id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
