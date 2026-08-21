"use client";

import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  FileText,
  FolderKanban,
  Globe2,
  LayoutGrid,
  Lock,
  LogOut,
  MessageSquare,
  Monitor,
  Pin,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useProjectStore } from "@/lib/project-store";
import NewProjectModal from "../dashboard/NewProjectModal";

const COLLAPSED_KEY = "archia-sidebar-collapsed";

function ProjectIcon({ project }: { project: { pinned?: boolean; is_public?: boolean } }) {
  if (project.pinned) return <Pin className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />;
  if (project.is_public) return <Globe2 className="h-3 w-3 shrink-0 text-emerald-400" />;
  return <Lock className="h-3 w-3 shrink-0 text-slate-500" />;
}

export default function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { projects, activeProjectId, createProject } = useProjectStore();
  const [expanded, setExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const project = useMemo(() => projects.find((p) => p.id === activeProjectId), [projects, activeProjectId]);

  const currentProject = useMemo(() => {
    const match = pathname.match(/^\/project\/([^/]+)(\/.*)?$/);
    return match ? match[1] : null;
  }, [pathname]);

  useEffect(() => {
    if (currentProject) setExpanded(true);
  }, [currentProject]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, search]);

  const navClass = "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition";
  const navActive = "bg-[var(--accent-muted)] text-indigo-200";
  const navIdle = "text-slate-400 hover:bg-white/5 hover:text-slate-200";

  function isActive(path: string) {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  async function handleCreate(data: { name: string; description: string; is_public: boolean }) {
    const p = await createProject({
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      access_list: [],
    });
    setModalOpen(false);
    router.push(`/project/${p.id}`);
  }

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm transition lg:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Collapse toggle button — fixed on the edge */}
      <button
        type="button"
        onClick={toggle}
        className="fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-lg border border-r-0 border-white/10 bg-[#0a0f18]/90 p-1.5 text-slate-400 shadow-lg backdrop-blur transition hover:bg-white/5 hover:text-slate-200"
        aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      <aside
        className={`relative z-30 flex shrink-0 flex-col border-r border-white/8 bg-[#0a0f18] transition-all duration-200 ${
          collapsed ? "w-0 translate-x-[-100%] overflow-hidden" : "w-64"
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-white/8 px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-md">
            <Command className="h-4 w-4 text-slate-950" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-100">Archia</span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded p-1 text-slate-500 hover:bg-white/5 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent-fg)] shadow transition hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Novo projeto
          </button>
        </div>

        {/* Search */}
        <div className="relative mx-3 mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pr-3 pl-8 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-[var(--accent)]"
          />
        </div>

        {/* Global nav */}
        <nav className="flex-1 overflow-y-auto px-2">
          <Section title="Geral" icon={<Sparkles className="h-3.5 w-3.5" />}>
            <Link href="/" className={`${navClass} ${isActive("/") ? navActive : navIdle}`}>
              <LayoutGrid className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/profile"
              className={`${navClass} ${isActive("/profile") ? navActive : navIdle}`}
            >
              <User className="h-4 w-4" />
              <span>Meu perfil</span>
            </Link>
          </Section>

          <Section title="Projetos" icon={<FolderKanban className="h-3.5 w-3.5" />} defaultOpen>
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                <Archive className="h-3 w-3" />
                {projects.length} projeto{projects.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="rounded p-0.5 text-slate-500 hover:text-slate-200"
                aria-label={expanded ? "Recolher projetos" : "Expandir projetos"}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>

            {expanded &&
              (filteredProjects.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-slate-500">
                  {search ? "Nenhum resultado" : "Nenhum projeto ainda."}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredProjects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/project/${p.id}`}
                        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                          p.id === currentProject ? "bg-[var(--accent-muted)] text-indigo-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        <ProjectIcon project={p} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="hidden text-[10px] text-slate-600 group-hover:block">
                          {p.pinned ? "fixado" : p.is_public ? "público" : "privado"}
                        </span>
                      </Link>
                      <ProjectSubNav projectId={p.id} />
                    </li>
                  ))}
                </ul>
              ))}
          </Section>

          <Section title="Ferramentas" icon={<Wrench className="h-3.5 w-3.5" />}>
            <span
              className={`${navClass} ${navIdle} cursor-not-allowed opacity-50`}
              title="Em desenvolvimento"
            >
              <Monitor className="h-4 w-4" />
              <span>Quadro Kanban</span>
            </span>
            <span
              className={`${navClass} ${navIdle} cursor-not-allowed opacity-50`}
              title="Em desenvolvimento"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Reuniões</span>
            </span>
          </Section>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/8 px-3 py-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
              {(user?.username ?? "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">{user?.username}</p>
              <p className="truncate text-[10px] text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-rose-300"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile toggle when collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          className="fixed bottom-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 shadow hover:bg-slate-700 lg:hidden"
          aria-label="Abrir menu"
        >
          ☰
        </button>
      )}

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
    </>
  );
}

function ProjectSubNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const current = pathname.startsWith(`/project/${projectId}`);
  if (!current) return null;

  const root = `/project/${projectId}`;
  return (
    <ul className="ml-4 space-y-0.5 border-l border-white/5 pl-2 py-0.5">
      <li>
        <Link
          href={root}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
            pathname === root ? "text-indigo-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Monitor className="h-3 w-3" />
          Editor
        </Link>
      </li>
      <li>
        <Link
          href={`${root}/doc`}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
            pathname === `${root}/doc` ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <FileText className="h-3 w-3" />
          Documentação
        </Link>
      </li>
      <li>
        <Link
          href={`${root}/members`}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
            pathname === `${root}/members` ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Users className="h-3 w-3" />
          Membros
        </Link>
      </li>
      <li>
        <Link
          href={`${root}/settings`}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
            pathname === `${root}/settings` ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Settings className="h-3 w-3" />
          Configurações
        </Link>
      </li>
    </ul>
  );
}

function Section({
  title,
  icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-white/5 hover:text-slate-300"
      >
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
