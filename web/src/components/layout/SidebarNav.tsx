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
  Sun,
  Moon,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  createContext,
} from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useProjectStore } from "@/lib/project-store";
import { useTheme } from "@/lib/theme-store";
import NewProjectModal from "../dashboard/NewProjectModal";
import DiagramGeneratorModal from "./DiagramGeneratorModal";

const COLLAPSED_KEY = "archia-sidebar-collapsed";

// ─── Context ───────────────────────────────────────────────────────────────────
interface SidebarCtx {
  collapsed: boolean;
}
const SidebarContext = createContext<SidebarCtx>({ collapsed: false });
// ─── Helpers ───────────────────────────────────────────────────────────────────
function ProjectIcon({ project }: { project: { pinned?: boolean; is_public?: boolean } }) {
  if (project.pinned) return <Pin className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />;
  if (project.is_public) return <Globe2 className="h-3 w-3 shrink-0 text-emerald-400" />;
  return <Lock className="h-3 w-3 shrink-0 text-[var(--muted)]" />;
}

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-2 py-1 text-xs font-medium shadow-lg text-[var(--foreground)]">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, setAvatarUrl } = useAuthStore();
  const avatarUrl = user?.avatar_url ?? null;
  const { theme, toggleTheme } = useTheme();
  const { projects, createProject, loadProjects } = useProjectStore();
  const [expanded, setExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // After the component mounts on the client, read the persisted collapsed state.
  useEffect(() => {
    setHydrated(true);
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored !== null) {
        setCollapsed(stored === "1");
      }
    } catch {
      // ignore errors – keep default (expanded)
    }
    // Load projects when sidebar mounts
    void loadProjects();
  }, [loadProjects]);

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

  const currentProject = useMemo(() => {
    const match = pathname.match(/^\/project\/([^/]+)(\/.*)?$/);
    return match ? match[1] : null;
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentProject) setExpanded(true);
  }, [currentProject]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, search]);

  const navClass = "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition";
  const navActive = "bg-[var(--accent-muted)] text-indigo-200";
  const navIdle = "text-(--muted-fg) hover:bg-(--surface-3) hover:text-(--foreground)";

  function isActive(path: string) {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  async function handleCreate(data: {
    name: string;
    description: string;
    is_public: boolean;
    project_kind?: import("@/lib/types").ProjectKind;
  }) {
    const p = await createProject({
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      project_kind: data.project_kind ?? "architecture",
      access_list: [],
    });
    setModalOpen(false);
    router.push(`/project/${p.id}`);
  }

  const initials = (user?.username ?? "U")[0].toUpperCase();

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      {/* Mobile overlay */}
      {hydrated && !collapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm transition lg:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside suppressHydrationWarning
        className={`relative z-30 flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-1)] transition-all duration-200 ${
          collapsed ? "w-16" : "w-64"
        } ${collapsed ? "overflow-hidden" : ""}`}
      >
        {/* ─── Toggle button (inside aside, right edge) ─── */}
        <button
          type="button"
          onClick={toggle}
          className={`absolute top-1/2 -translate-y-1/2 z-40 rounded-l-lg border border-l-0 border-[var(--border)] bg-[var(--surface-1)]/95 p-1.5 text-[var(--muted-fg)] shadow-lg backdrop-blur transition hover:bg-(--surface-3) hover:text-(--foreground) ${
            collapsed ? "right-0 top-1/2" : "right-0 top-1/2"
          }`}
          style={{ top: "50%" }}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* ─── FULL SIDEBAR ─── */}
        {!collapsed && (
          <>
            {/* Logo */}
            <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-md">
                <Command className="h-4 w-4 text-slate-950" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-slate-100">
                Archia
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="ml-auto rounded p-1 text-[var(--muted)] hover:bg-(--surface-3) lg:hidden"
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
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 py-2 pr-3 pl-8 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)] focus:border-[var(--accent)]"
              />
            </div>

            {/* Global nav */}
            <nav className="flex-1 overflow-y-auto px-2">
              <Section title="Geral" icon={<Sparkles className="h-3.5 w-3.5" />}>
                <Link
                  href="/"
                  className={`${navClass} ${isActive("/") ? navActive : navIdle}`}
                >
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

              <Section
                title="Projetos"
                icon={<FolderKanban className="h-3.5 w-3.5" />}
                defaultOpen
              >
                <div className="mb-1 flex items-center justify-between px-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-[var(--muted)]">
                    <Archive className="h-3 w-3" />
                    {projects.length} projeto{projects.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="rounded p-0.5 text-[var(--muted)] hover:text-(--foreground)"
                    aria-label={expanded ? "Recolher projetos" : "Expandir projetos"}
                  >
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {expanded &&
                  (filteredProjects.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-[var(--muted)]">
                      {search ? "Nenhum resultado" : "Nenhum projeto ainda."}
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {filteredProjects.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/project/${p.id}`}
                            className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                              p.id === currentProject
                                ? "bg-[var(--accent-muted)] text-indigo-200"
                                : "text-[var(--muted-fg)] hover:bg-(--surface-3) hover:text-(--foreground)"
                            }`}
                          >
                            <ProjectIcon project={p} />
                            <span className="min-w-0 flex-1 truncate">
                              {p.name}
                            </span>
                            <span className="hidden text-sm text-[var(--muted-fg)] group-hover:block">
                              {p.pinned
                                ? "fixado"
                                : p.is_public
                                  ? "público"
                                  : "privado"}
                            </span>
                          </Link>
                          <ProjectSubNav projectId={p.id} />
                        </li>
                      ))}
                    </ul>
                  ))}
              </Section>

              <Section
                title="Ferramentas"
                icon={<Wrench className="h-3.5 w-3.5" />}
              >
                <button
                  type="button"
                  onClick={() => setDiagramModalOpen(true)}
                  className={`${navClass} ${navIdle} w-full text-left`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Criar Diagrama</span>
                </button>
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
            <div className="border-t border-[var(--border)] px-3 py-3">
              <Link href="/profile" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--muted-fg)] transition hover:bg-(--surface-3) hover:text-(--foreground)">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full overflow-hidden bg-slate-700">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-slate-200">{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {user?.username}
                  </p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {user?.email}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded p-1 text-[var(--muted)] hover:bg-(--surface-3) hover:text-amber-300"
                  title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                  aria-label={
                    theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
                  }
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-indigo-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="rounded p-1 text-[var(--muted)] hover:bg-(--surface-3) hover:text-rose-300"
                  title="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── MINI SIDEBAR (collapsed) ─── */}
        {collapsed && (
          <>
            {/* Logo */}
            <div className="flex h-14 items-center justify-center border-b border-[var(--border)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-md">
                <Command className="h-5 w-5 text-slate-950" />
              </div>
            </div>

            {/* Nav icons */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <div className="space-y-1">
                <Tooltip text="Dashboard">
                  <Link
                    href="/"
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      isActive("/")
                        ? "bg-[var(--accent-muted)] text-indigo-300"
                        : "text-[var(--muted-fg)] hover:bg-(--surface-3) hover:text-(--foreground)"
                    }`}
                  >
                    <LayoutGrid className="h-5 w-5" />
                  </Link>
                </Tooltip>

                <Tooltip text={`Projetos (${projects.length})`}>
                  <Link
                    href="/project"
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      pathname.startsWith("/project")
                        ? "bg-[var(--accent-muted)] text-indigo-300"
                        : "text-[var(--muted-fg)] hover:bg-(--surface-3) hover:text-(--foreground)"
                    }`}
                  >
                    <FolderKanban className="h-5 w-5" />
                  </Link>
                </Tooltip>

                <div className="my-2 border-t border-[var(--border)]" />

                <Tooltip text="Meu perfil">
                  <Link
                    href="/profile"
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      isActive("/profile")
                        ? "bg-[var(--accent-muted)] text-indigo-300"
                        : "text-[var(--muted-fg)] hover:bg-(--surface-3) hover:text-(--foreground)"
                    }`}
                  >
                    <User className="h-5 w-5" />
                  </Link>
                </Tooltip>
              </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-[var(--border)] px-2 py-3">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-fg)] transition hover:bg-(--surface-3) hover:text-(--foreground)"
                  title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                  aria-label={
                    theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
                  }
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5 text-amber-400" />
                  ) : (
                    <Moon className="h-5 w-5 text-indigo-400" />
                  )}
                </button>

                <Tooltip text="Sair">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      router.push("/login");
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-fg)] transition hover:bg-(--surface-3) hover:text-rose-300"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </Tooltip>

                <Tooltip text="Meu perfil">
                  <Link
                    href="/profile"
                    className="mt-1 flex h-7 w-7 items-center justify-center rounded-full overflow-hidden bg-slate-700 transition hover:bg-[var(--accent-muted)] hover:text-indigo-200"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-200">{initials}</span>
                    )}
                  </Link>
                </Tooltip>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Mobile toggle when collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          className="fixed bottom-4 left-20 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 shadow hover:bg-slate-700 lg:hidden"
          aria-label="Abrir menu"
        >
          ☰
        </button>
      )}

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      {diagramModalOpen && (
        <DiagramGeneratorModal
          onClose={() => setDiagramModalOpen(false)}
        />
      )}
    </SidebarContext.Provider>
  );
}

function ProjectSubNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const current = pathname.startsWith(`/project/${projectId}`);
  if (!current) return null;

  const root = `/project/${projectId}`;
  return (
    <ul className="ml-4 space-y-0.5 border-l border-[var(--border)] pl-2 py-0.5">
      <li>
        <Link
          href={root}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
            pathname === root
              ? "text-indigo-300"
              : "text-[var(--muted)] hover:text-(--foreground)"
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
            pathname === `${root}/doc`
              ? "text-indigo-300"
              : "text-[var(--muted)] hover:text-(--foreground)"
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
            pathname === `${root}/members`
              ? "text-indigo-300"
              : "text-[var(--muted)] hover:text-(--foreground)"
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
            pathname === `${root}/settings`
              ? "text-indigo-300"
              : "text-[var(--muted)] hover:text-(--foreground)"
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
        className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted)] hover:bg-(--surface-3) hover:text-(--foreground)"
      >
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
