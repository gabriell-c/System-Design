export type NodeKind =
  | "frontend"
  | "backend"
  | "database"
  | "cloud"
  | "messaging"
  | "identity"
  | "observability"
  | "integration"
  | "deploy";

export const ALL_NODE_KINDS: NodeKind[] = [
  "frontend",
  "backend",
  "database",
  "cloud",
  "messaging",
  "identity",
  "observability",
  "integration",
  "deploy",
];

export type CanvasNodeKind = NodeKind | "block";

export type Severity = "info" | "warning" | "critical";

export type UserRole = "senior" | "other";

export type ReviewStatus = "draft" | "analyzed" | "pending_review" | "approved" | "rejected";

export type CloudLayer = "compute" | "data" | "edge" | "platform";

export type ArchNodeConfig = {
  framework?: string;
  uiLib?: string;
  state?: string;
  rendering?: string;
  engine?: string;
  provider?: string;
  service?: string;
  layer?: CloudLayer;
};

export type ArchNodeData = {
  kind: NodeKind;
  label: string;
  catalogId: string;
  tech: string;
  config: ArchNodeConfig;
  score?: number | null;
  summary?: string;
};

export type BlockNodeData = {
  kind: "block";
  label: string;
  domain: NodeKind;
  description?: string;
  score?: number | null;
  summary?: string;
};

export type CanvasNodeData = ArchNodeData | BlockNodeData;

export function isBlockData(data: CanvasNodeData): data is BlockNodeData {
  return data.kind === "block";
}

export function isArchData(data: CanvasNodeData): data is ArchNodeData {
  return data.kind !== "block";
}

export type MetricEstimate = {
  label: string;
  value: string;
  unit?: string;
  is_estimate: true;
};

export type Finding = {
  node_id?: string | null;
  severity: Severity;
  title: string;
  detail: string;
  metric?: MetricEstimate | null;
};

export type GrowthScenario = {
  ok: boolean;
  issues: string[];
  changes: string[];
};

export type AnalysisResult = {
  score: number;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  findings: Finding[];
  node_scores: Record<string, number>;
  growth: {
    small: GrowthScenario;
    medium: GrowthScenario;
    large: GrowthScenario;
  };
  ia_ok: boolean;
  ia_unavailable: boolean;
  agents_used: string[];
};

export type EnvironmentPlan = {
  has_dev: boolean;
  has_staging: boolean;
  has_prod: boolean;
  has_ci_cd: boolean;
  has_backups: boolean;
  has_monitoring_plan: boolean;
};

export type ProjectNfr = {
  users_per_day: number | null;
  budget_usd_month: number | null;
  availability_pct: number | null;
  latency_p99_ms: number | null;
  compliance: string[];
  team_size: number | null;
  deadline_weeks: number | null;
  environments: EnvironmentPlan;
};

export type GraphRecord = {
  id: string;
  name: string;
  context?: string;
  nfr?: ProjectNfr | null;
  nodes: unknown[];
  edges: unknown[];
  analysis: AnalysisResult | null;
  review_status: ReviewStatus;
  review_comment: string | null;
  reviewer_role: UserRole | null;
  created_at: string;
  updated_at: string;
};

export type GraphVersion = {
  id: string;
  graph_id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  created_at: string;
};

export type CatalogCategory = "language" | "framework" | "library" | "service" | "database" | "platform" | "tool";

export type CatalogItem = {
  id: string;
  kind: NodeKind;
  label: string;
  tech: string;
  description: string;
  defaults: ArchNodeConfig;
  layer?: CloudLayer;
  /** Tipo do item: linguagem, framework, biblioteca, serviço, etc. */
  category?: CatalogCategory;
  /** Popularidade 1–10 (10 = mais usado no mercado em 2025) */
  popularity?: number;
  /** Tags extras para busca */
  tags?: string[];
};

/** Preferências do usuário sobre quais componentes aparecem na paleta */
export type UserCatalogPrefs = {
  /** IDs dos items visíveis (se vazio = todos visíveis) */
  visibleIds: string[];
  /** IDs dos items fixados no topo */
  pinnedIds: string[];
  /** Kinds inteiramente ocultos */
  hiddenKinds: NodeKind[];
  /** Categorias ocultas dentro de um kind */
  hiddenCategories: Record<string, CatalogCategory[]>;
};

export const DEFAULT_CATALOG_PREFS: UserCatalogPrefs = {
  visibleIds: [],
  pinnedIds: [],
  hiddenKinds: [],
  hiddenCategories: {},
};

/** Regra de recomendação IA */
export type StackRecommendation = {
  /** Contexto detectado (ex: "mobile-app", "saas-b2b", "ecommerce") */
  context: string;
  /** O que o usuário escolheu */
  chosen: string;
  /** O que a IA recomenda */
  recommended: string;
  /** Razão da recomendação */
  reason: string;
  /** Se é uma recomendação forte (true) ou sugestão leve (false) */
  strong: boolean;
};

export type KickoffItem = {
  id: string;
  label: string;
  detail: string;
  status: "ok" | "missing" | "warn";
  severity: Severity;
};

export type AdrEntry = {
  id: string;
  title: string;
  status: "proposto" | "aceito";
  context: string;
  decision: string;
  consequences: string[];
};
