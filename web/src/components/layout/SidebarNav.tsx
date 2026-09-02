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
        } ${effectiveCollapsed ? "overflow-hidden" : "overflow-y-auto"}
        ${
          theme === "dark"
            ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-r border-slate-800/50"
            : "bg-gradient-to-b from-slate-50 via-white to-slate-50 border-r border-slate-200/50"
        }`}
      >
        {/* Toggle button — always visible */}
        <button
          type="button"
          onClick={toggle}
          className={`absolute top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-6 h-10 rounded-l-lg border border-l-0 border-slate-700/50 ${
            theme === "dark"
              ? "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          } transition-all duration-200 ${effectiveCollapsed ? "right-0" : "right-0"}`}
          aria-label={effectiveCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {effectiveCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
        {/* ─── Toggle button (inside aside, right edge) ─── */}

        {/* ─── FULL SIDEBAR ─── */}
        {!effectiveCollapsed && (
          <>
            {/* Logo Header */}
            <div className={`flex items-center gap-3 border-b px-6 py-6 ${
              theme === "dark"
                ? "border-slate-800/50 bg-gradient-to-b from-slate-900 to-slate-950"
                : "border-slate-200/50 bg-gradient-to-b from-slate-50 to-white"
            }`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg ${
                theme === "dark"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30"
                  : "bg-gradient-to-br from-blue-400 to-blue-500 shadow-blue-500/20"
              }`}>
                <Command className={`h-5 w-5 ${theme === "dark" ? "text-white" : "text-white"}`} />
              </div>
              <div className="flex-1">
                <h1 className={`text-lg font-bold tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Archia</h1>
                <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Design System</p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className={`rounded-lg p-1.5 transition lg:hidden ${
                  theme === "dark"
                    ? "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                }`}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-4 border-b border-slate-800/50">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all duration-200"
              >
                <Plus className="h-5 w-5" />
                Novo Projeto
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-800/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition"
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4">
              {/* Main Menu Section */}
              <div className="mb-8">
                <p className="mb-4 px-0 text-xs font-semibold uppercase text-slate-500 tracking-widest">Menu Principal</p>
                <div className="space-y-2">
                  <Link
                    href="/"
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                      isActive("/")
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <LayoutGrid className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">Dashboard</span>
                  </Link>

                  <Link
                    href="/graphs"
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                      isActive("/graphs")
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <Monitor className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">Diagramas</span>
                  </Link>

                  <Link
                    href="/compare"
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                      isActive("/compare")
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
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
                  className="mb-4 flex w-full items-center justify-between px-0 transition"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500 tracking-widest">Meus Projetos</p>
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                </button>
                
                {expanded && (
                  <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
                    {filteredProjects.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-500 text-center">Nenhum projeto</p>
                    ) : (
                      filteredProjects.map((p) => (
                        <Link
                          key={p.id}
                          href={`/project/${p.id}`}
                          className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-200 ${
                            currentProject === p.id
                              ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
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
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-indigo-400" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-500" />
                  )}
                  <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
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
            <div className="flex h-14 items-center justify-center border-b border-slate-800/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-md">
                <Command className="h-5 w-5 text-slate-950" />
              </div>
            </div>

            {/* Nav icons */}
            <nav className="flex-1 min-w-0 overflow-y-auto px-2 py-4">
              <div className="space-y-3">
                <Link
                  href="/"
                  className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ${
                    isActive("/")
                      ? "bg-indigo-500/20 text-indigo-300 shadow-md shadow-indigo-500/20"
                      : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-300"
                  }`}
                >
                  <LayoutGrid className="h-6 w-6" />
                </Link>

                <Link
                  href="/project"
                  className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ${
                    pathname.startsWith("/project")
                      ? "bg-indigo-500/20 text-indigo-300 shadow-md shadow-indigo-500/20"
                      : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-300"
                  }`}
                >
                  <FolderKanban className="h-6 w-6" />
                </Link>

                <div className="my-1 border-t border-slate-700/50" />

                <Link
                  href="/profile"
                  className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ${
                    isActive("/profile")
                      ? "bg-indigo-500/20 text-indigo-300 shadow-md shadow-indigo-500/20"
                      : "text-slate-400 hover:bg-indigo-500/10 hover:text-slate-300"
                  }`}
                >
                  <User className="h-6 w-6" />
                </Link>
              </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-slate-800/50 px-2 py-4">
              <div className="flex flex-col items-center gap-3">
                {/* Theme Toggle (só ícone) */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all duration-200"
                  title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                >
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                </button>

                <div className="w-full border-t border-slate-800/50" />

                {/* Sair (só ícone) */}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
                  title="Sair"
                >
                  <LogOut className="h-5 w-5" />
                </button>

                <div className="w-full border-t border-slate-800/50" />

                {/* Perfil (só ícone) */}
                <Link
                  href="/profile"
                  className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden bg-slate-700 hover:bg-indigo-500/20 transition-all duration-200"
                  title="Perfil"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-slate-200">{initials}</span>
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
