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
export default function SidebarNav({ forceExpanded = false }: { forceExpanded?: boolean }) {
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
  const [collapsed, setCollapsed] = useState(true); // ✅ Começa minimizada em TODAS as páginas
  const [hydrated, setHydrated] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  // Sidebar expands on hover, collapses when mouse leaves
  const effectiveCollapsed = forceExpanded ? false : (collapsed && !isHovering);
  // After the component mounts on the client, read the persisted collapsed state.
  useEffect(() => {
    setHydrated(true);
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (!forceExpanded && stored !== null) {
        setCollapsed(stored === "1");
      }
    } catch {
      // ignore errors – keep default (expanded)
    }
    // Load projects when sidebar mounts
    void loadProjects();
  }, [forceExpanded, loadProjects]);

  const toggle = useCallback(() => {
    if (forceExpanded) return;
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [forceExpanded]);

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

  const navClass = "flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm transition";
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
    <SidebarContext.Provider value={{ collapsed: effectiveCollapsed }}>
      {/* Mobile overlay */}
      {hydrated && !effectiveCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm transition lg:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside suppressHydrationWarning
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`relative z-30 flex shrink-0 flex-col transition-all duration-300 ${
          effectiveCollapsed ? "w-20" : "w-72"
        } ${effectiveCollapsed ? "overflow-hidden" : "overflow-y-auto scrollbar-thin scrollbar-thumb-violet-700/30 scrollbar-track-transparent"}
        ${
          theme === "dark"
            ? "bg-violet-950 border-r border-violet-800/30"
            : "bg-white border-r border-violet-100"
        }`}
      >

        {/* ─── FULL SIDEBAR ─── */}
        {!effectiveCollapsed && (
          <>
            {/* Logo Header */}
            <div className={`flex items-center gap-3 border-b px-6 py-5 ${
              theme === "dark"
                ? "border-violet-800/20 bg-violet-950"
                : "border-violet-100 bg-white"
            }`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                theme === "dark"
                  ? "bg-violet-600"
                  : "bg-violet-600"
              }`}>
                <Command className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className={`text-lg font-bold tracking-tight leading-tight ${
                  theme === "dark" ? "text-white" : "text-violet-900"
                }`}>Archia</h1>
                <p className={`text-xs font-medium ${
                  theme === "dark" ? "text-violet-400/60" : "text-violet-600/60"
                }`}>Design System</p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className={`rounded-lg p-1.5 transition-colors lg:hidden focus:outline-none focus:ring-2 ${
                  theme === "dark"
                    ? "text-violet-400 hover:bg-violet-800/30 focus:ring-violet-500/50"
                    : "text-violet-600 hover:bg-violet-100 focus:ring-violet-400/50"
                }`}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className={`px-4 py-3 border-b ${
              theme === "dark"
                ? "border-violet-800/20"
                : "border-violet-100"
            }`}>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 ${
                  theme === "dark"
                    ? "bg-violet-600 hover:bg-violet-700 text-white focus:ring-violet-500/50"
                    : "bg-violet-600 hover:bg-violet-700 text-white focus:ring-violet-400/50"
                }`}
              >
                <Plus className="h-5 w-5" />
                Novo Projeto
              </button>
            </div>

            {/* Search */}
            <div className={`px-4 py-3 border-b ${
              theme === "dark"
                ? "border-violet-800/20"
                : "border-violet-100"
            }`}>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
                  theme === "dark"
                    ? "text-violet-400"
                    : "text-violet-600"
                }`} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full rounded-lg pl-10 pr-4 py-2 text-sm transition focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-violet-900/30 border border-violet-800/30 text-white placeholder-violet-400 focus:ring-violet-500/50 focus:bg-violet-900/50"
                      : "bg-violet-50 border border-violet-200 text-violet-900 placeholder-violet-500 focus:ring-violet-400/50 focus:bg-white"
                  }`}
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4">
              {/* Main Menu Section */}
              <div className="mb-8">
                <p className={`mb-3 px-0 text-xs font-semibold uppercase tracking-widest ${
                  theme === "dark"
                    ? "text-violet-400/50"
                    : "text-violet-600/50"
                }`}>Menu Principal</p>
                <div className="space-y-1">
                  <Link
                    href="/"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${
                      isActive("/")
                        ? theme === "dark"
                          ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                          : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                        : theme === "dark"
                          ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                          : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                    }`}
                  >
                    <LayoutGrid className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">Dashboard</span>
                  </Link>

                  <Link
                    href="/graphs"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${
                      isActive("/graphs")
                        ? theme === "dark"
                          ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                          : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                        : theme === "dark"
                          ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                          : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                    }`}
                  >
                    <Monitor className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">Diagramas</span>
                  </Link>

                  <Link
                    href="/compare"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${
                      isActive("/compare")
                        ? theme === "dark"
                          ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                          : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                        : theme === "dark"
                          ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                          : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                    }`}
                  >
                    <Sparkles className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">Comparar</span>
                  </Link>
                </div>
              </div>

              {/* Projects Section */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mb-3 flex w-full items-center justify-between px-0 transition focus:outline-none focus:ring-2 focus:ring-offset-0 rounded"
                >
                  <p className={`text-xs font-semibold uppercase tracking-widest ${
                    theme === "dark"
                      ? "text-violet-400/50"
                      : "text-violet-600/50"
                  }`}>Meus Projetos</p>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                    theme === "dark"
                      ? "text-violet-400/50"
                      : "text-violet-600/50"
                  } ${expanded ? "rotate-180" : ""}`} />
                </button>
                
                {expanded && (
                  <div className="space-y-1 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-violet-600/30 scrollbar-track-transparent">
                    {filteredProjects.length === 0 ? (
                      <p className={`px-3 py-2 text-xs text-center ${
                        theme === "dark"
                          ? "text-violet-400/40"
                          : "text-violet-600/40"
                      }`}>Nenhum projeto</p>
                    ) : (
                      filteredProjects.map((p) => (
                        <Link
                          key={p.id}
                          href={`/project/${p.id}`}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${
                            currentProject === p.id
                              ? theme === "dark"
                                ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                                : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                              : theme === "dark"
                                ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                                : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                          }`}
                        >
                          <FolderKanban className="h-4 w-4 shrink-0" />
                          <span className="truncate font-medium text-sm">{p.name}</span>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            </nav>

            {/* Global nav */}
            <nav className="flex-1 min-w-0 overflow-y-auto px-2">
              <Section title="Geral" icon={<Sparkles className="h-3.5 w-3.5" />}>
                <Link
                  href="/"
                  className={`${navClass} ${isActive("/") ? navActive : navIdle}`}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Dashboard</span>
                </Link>
                <Link
                  href="/profile"
                  className={`${navClass} ${isActive("/profile") ? navActive : navIdle}`}
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Meu perfil</span>
                </Link>
              </Section>

              <Section title="Projetos" icon={<FolderKanban className="h-4 w-4" />}>
                <div className="mb-1 flex items-center justify-between px-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-[var(--muted)]">
                    <Archive className="h-3 w-3 shrink-0" />
                    <span className="truncate">{projects.length} projeto{projects.length !== 1 ? "s" : ""}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="ml-1 flex shrink-0 items-center justify-center rounded-lg p-2 text-(--muted) transition-all hover:bg-(--accent-muted) hover:text-(--accent-fg)"
                    aria-label={expanded ? "Recolher projetos" : "Expandir projetos"}
                    title={expanded ? "Recolher projetos" : "Expandir projetos"}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
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
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Criar Diagrama</span>
                </button>
                <span
                  className={`${navClass} ${navIdle} cursor-not-allowed opacity-50`}
                  title="Em desenvolvimento"
                >
                  <Monitor className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Quadro Kanban</span>
                </span>
                <span
                  className={`${navClass} ${navIdle} cursor-not-allowed opacity-50`}
                  title="Em desenvolvimento"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Reuniões</span>
                </span>
              </Section>
            </nav>

            {/* Footer */}
            <div className={`border-t px-3 py-3 ${
              theme === "dark"
                ? "border-violet-800/20"
                : "border-violet-100"
            }`}>
              <Link href="/profile" className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                  : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
              }`}>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full overflow-hidden ${
                  theme === "dark"
                    ? "bg-violet-600"
                    : "bg-violet-600"
                }`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xs font-medium ${
                    theme === "dark"
                      ? "text-violet-100"
                      : "text-violet-900"
                  }`}>
                    {user?.username}
                  </p>
                  <p className={`truncate text-xs ${
                    theme === "dark"
                      ? "text-violet-400/60"
                      : "text-violet-600/60"
                  }`}>
                    {user?.email}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-violet-800/20">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Moon className={`h-4 w-4 ${theme === "dark" ? "text-violet-400" : "text-violet-600"}`} />
                  ) : (
                    <Sun className={`h-4 w-4 ${theme === "dark" ? "text-violet-400" : "text-violet-600"}`} />
                  )}
                  <span className={`text-xs font-medium ${theme === "dark" ? "text-violet-300" : "text-violet-700"}`}>
                    {theme === "dark" ? "Escuro" : "Claro"}
                  </span>
                </div>
                
                {/* Theme Toggle Switch */}
                <label className="theme-switch-container">
                  <input
                    type="checkbox"
                    checked={theme !== "dark"}
                    onChange={toggleTheme}
                  />
                  <span className="theme-switch-slider" />
                </label>
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
        {effectiveCollapsed && (
          <>
            {/* Logo */}
            <div className={`flex h-14 items-center justify-center border-b ${
              theme === "dark"
                ? "border-violet-800/20"
                : "border-violet-100"
            }`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                theme === "dark"
                  ? "bg-violet-600"
                  : "bg-violet-600"
              }`}>
                <Command className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Nav icons */}
            <nav className="flex-1 min-w-0 overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-thumb-violet-600/30 scrollbar-track-transparent">
              <div className="space-y-2">
                <Link
                  href="/"
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                    isActive("/")
                      ? theme === "dark"
                        ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                        : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                      : theme === "dark"
                        ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                        : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                  }`}
                  title="Dashboard"
                >
                  <LayoutGrid className="h-5 w-5" />
                </Link>

                <Link
                  href="/project"
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                    pathname.startsWith("/project")
                      ? theme === "dark"
                        ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                        : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                      : theme === "dark"
                        ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                        : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                  }`}
                  title="Projetos"
                >
                  <FolderKanban className="h-5 w-5" />
                </Link>

                <div className={`my-1 border-t ${
                  theme === "dark"
                    ? "border-violet-800/20"
                    : "border-violet-100"
                }`} />

                <Link
                  href="/profile"
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                    isActive("/profile")
                      ? theme === "dark"
                        ? "bg-violet-600/20 text-violet-100 focus:ring-violet-500/50"
                        : "bg-violet-100 text-violet-900 focus:ring-violet-400/50"
                      : theme === "dark"
                        ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                        : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                  }`}
                  title="Perfil"
                >
                  <User className="h-5 w-5" />
                </Link>
              </div>
            </nav>

            {/* Footer */}
            <div className={`border-t px-2 py-3 ${
              theme === "dark"
                ? "border-violet-800/20"
                : "border-violet-100"
            }`}>
              <div className="flex flex-col items-center gap-2">
                {/* Theme Toggle (só ícone) */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "text-violet-300 hover:bg-violet-900/30 focus:ring-violet-500/50"
                      : "text-violet-700 hover:bg-violet-50 focus:ring-violet-400/50"
                  }`}
                  title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                >
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                </button>

                <div className={`w-full border-t ${
                  theme === "dark"
                    ? "border-violet-800/20"
                    : "border-violet-100"
                }`} />

                {/* Sair (só ícone) */}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "text-rose-300 hover:bg-rose-900/30 focus:ring-rose-500/50"
                      : "text-rose-600 hover:bg-rose-50 focus:ring-rose-400/50"
                  }`}
                  title="Sair"
                >
                  <LogOut className="h-5 w-5" />
                </button>

                <div className={`w-full border-t ${
                  theme === "dark"
                    ? "border-violet-800/20"
                    : "border-violet-100"
                }`} />

                {/* Perfil (só ícone) */}
                <Link
                  href="/profile"
                  className={`flex h-9 w-9 items-center justify-center rounded-full overflow-hidden transition-colors focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-violet-600 hover:bg-violet-700 focus:ring-violet-500/50"
                      : "bg-violet-600 hover:bg-violet-700 focus:ring-violet-400/50"
                  }`}
                  title="Perfil"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{initials}</span>
                  )}
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>

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
        className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--muted)] hover:bg-(--surface-3) hover:text-(--foreground) transition-colors"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        {open ? (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform" />
        ) : (
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform" />
        )}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
