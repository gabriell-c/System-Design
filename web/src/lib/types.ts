export type NodeKind =
  | "frontend"
  | "backend"
  | "database"
  | "cloud"
  | "identity"
  | "observability"
  | "integration"
  | "deploy"
  | "security";

export const ALL_NODE_KINDS: NodeKind[] = [
  "frontend",
  "backend",
  "database",
  "cloud",
  "identity",
  "observability",
  "integration",
  "deploy",
  "security",
];

export type CanvasNodeKind = NodeKind | "block" | "zone";

export type Severity = "info" | "warning" | "critical";

export type UserRole = "senior" | "other";

export type ReviewStatus = "draft" | "analyzed" | "pending_review" | "approved" | "rejected";

export type CloudLayer = "compute" | "data" | "edge" | "platform";

export type CloudProvider = "aws" | "azure" | "gcp" | "generic";

/** Contêineres de arquitetura real (cloud-agnostic). */
export type ZoneKind =
  | "region"
  | "vpc"
  | "availability_zone"
  | "subnet_public"
  | "subnet_private"
  | "layer"
  | "plane"
  | "security_boundary"
  | "peering"
  | "vpn"
  | "privatelink"
  | "express_route"
  | "data_mesh"
  | "tgw"
  | "nat_gateway"
  | "prefix_list"
  | "dr_region";

export const ALL_ZONE_KINDS: ZoneKind[] = [
  "region",
  "vpc",
  "availability_zone",
  "subnet_public",
  "subnet_private",
  "layer",
  "plane",
  "security_boundary",
  "peering",
  "vpn",
  "privatelink",
  "express_route",
  "data_mesh",
  "tgw",
  "nat_gateway",
  "prefix_list",
  "dr_region",
];

export type FlowKind = "sync" | "async" | "data" | "control" | "management";

export type FlowProtocol = "https" | "grpc" | "amqp" | "kafka" | "sql" | "s3" | "other";

export type FailureBehavior = "retry" | "fallback" | "dlq" | "fail_fast" | "none";

export type ArchEdgeData = {
  flowKind: FlowKind;
  protocol?: FlowProtocol;
  flowNumber?: number;
  label?: string;
  isCriticalPath?: boolean;
  failureBehavior?: FailureBehavior;
  firewallRules?: FirewallRule[];
};

export type FirewallRule = {
  port: string;
  protocol: "tcp" | "udp" | "all";
  direction: "inbound" | "outbound";
  description?: string;
};

export type NodeComment = {
  id: string;
  nodeId?: string | null;
  node_id?: string | null;
  text: string;
  author: string;
  created_at: string;
  position_x?: number | null;
  position_y?: number | null;
  resolved?: boolean;
  assignee?: string | null;
  mentions?: string[];
  thread_parent_id?: string | null;
};

export type CanvasComment = NodeComment;

export type SimulationScenarioRecord = {
  id: string;
  graph_id: string;
  name: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ArchStyle =
  | "monolithic"
  | "layered"
  | "microservices"
  | "event_driven"
  | "hexagonal"
  | "serverless"
  | "soa";

export type ArchNodeConfig = {
  framework?: string;
  uiLib?: string;
  state?: string;
  rendering?: string;
  engine?: string;
  provider?: string;
  service?: string;
  layer?: CloudLayer;
  /** Capability multi-cloud (dns, api_edge, secrets, …) */
  capability?: string;
};

export type PiiSensitivity = "none" | "low" | "medium" | "high" | "restricted";

export type C4Level = "system" | "container" | "component" | "code";

export const ALL_C4_LEVELS: C4Level[] = ["system", "container", "component", "code"];

export type CapacityContract = {
  max_rps?: number;
  p99_latency_ms?: number;
  max_connections?: number;
  notes?: string;
};

export type ArchNodeData = {
  kind: NodeKind;
  label: string;
  catalogId: string;
  tech: string;
  config: ArchNodeConfig;
  score?: number | null;
  summary?: string;
  /** Gargalo detectado na análise (pulse vermelho no canvas). */
  bottleneck?: boolean;
  /** P1.1.5 — classificação PII para cards de banco */
  piiSensitivity?: PiiSensitivity;
  /** P2.1.2 — nível C4 do elemento no diagrama */
  c4Level?: C4Level;
  /** P1.3.5 — contrato de capacidade editável */
  capacityContract?: CapacityContract;
};

export type BlockNodeData = {
  kind: "block";
  label: string;
  domain: NodeKind;
  description?: string;
  score?: number | null;
  summary?: string;
  bottleneck?: boolean;
};

export type ZoneNodeData = {
  kind: "zone";
  zoneKind: ZoneKind;
  label: string;
  provider?: CloudProvider;
  description?: string;
  /** P1.1.1 — bounded context name for DDD/data mesh */
  boundedContext?: string;
  score?: number | null;
  summary?: string;
  bottleneck?: boolean;
};

export type CanvasNodeData = ArchNodeData | BlockNodeData | ZoneNodeData;

export function isBlockData(data: CanvasNodeData): data is BlockNodeData {
  return data.kind === "block";
}

export function isZoneData(data: CanvasNodeData): data is ZoneNodeData {
  return data.kind === "zone";
}

export function isArchData(data: CanvasNodeData): data is ArchNodeData {
  return data.kind !== "block" && data.kind !== "zone";
}

export type MetricEstimate = {
  label: string;
  value: string;
  unit?: string;
  is_estimate: true;
};

export type FixAction = {
  action_type: string;
  label: string;
  payload: Record<string, unknown>;
};

export type Finding = {
  node_id?: string | null;
  severity: Severity;
  title: string;
  detail: string;
  metric?: MetricEstimate | null;
  fix_action?: FixAction | null;
};

export type ScoreFactor = {
  label: string;
  impact: number;
  detail?: string;
};

export type ScoreBreakdown = {
  base_score: number;
  explained_score: number;
  factors: ScoreFactor[];
  critical_node_ids: string[];
  finding_counts: Record<string, number>;
};

export type DomainBenchmark = {
  domain: string;
  triggered_rules: string[];
  status: "pass" | "fail";
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
  arch_style?: string | null;
  style_confidence?: number;
  domain_coherence?: {
    an: number;
    ad: number;
    aa: number;
    ai: number;
    geral: number;
  } | null;
  cohesion_coupling?: {
    cohesion_score: number;
    coupling_score: number;
    por_dominio?: Record<string, number>;
  } | null;
  trade_offs?: Array<{
    decisao: string;
    alternativa_rejeitada: string;
    vantagem: string;
    desvantagem: string;
    criterio_escolha: string;
  }>;
  style_findings?: Finding[];
  review_scorecard?: {
    narrative: number;
    views_completeness: number;
    placement: number;
    flow_continuity: number;
    operability: number;
    decision_quality: number;
    overall: number;
    review_ready: boolean;
    gaps: string[];
  } | null;
  score_breakdown?: ScoreBreakdown | null;
  benchmarks?: DomainBenchmark[];
  threat_findings?: Finding[];
  well_architected?: {
    narrative: number;
    views_completeness: number;
    placement: number;
    flow_continuity: number;
    operability: number;
    decision_quality: number;
    overall: number;
    review_ready: boolean;
    gaps: string[];
  } | null;
};

export type EnvironmentPlan = {
  has_dev: boolean;
  has_staging: boolean;
  has_prod: boolean;
  has_ci_cd: boolean;
  has_backups: boolean;
  has_monitoring_plan: boolean;
};

export type FailureMode = {
  component_id: string;
  mode: string;
  impact: string;
  mitigation: string;
};

export type DataOwnership = {
  entity: string;
  owner_team?: string;
  owner_role?: string;
  write_freq?: 'realtime' | 'batch' | 'streaming';
  retention_days?: number;
  pii?: boolean;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
};

export type ApiContract = {
  service: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  protocol?: 'rest' | 'graphql' | 'grpc' | 'async';
  schema_url?: string;
  openapi_url?: string;
  asyncapi_url?: string;
  flow_exists?: boolean;
  version?: string;
  description?: string;
};

export type EventTopic = {
  name: string;
  protocol?: 'kafka' | 'rabbitmq' | 'sns' | 'pubsub';
  schema_type?: 'avro' | 'protobuf' | 'jsonschema' | 'json';
  schema_version?: string;
  schema_registry_url?: string;
  retention_hours?: number;
  consumers?: string[];
  producers?: string[];
  dlq?: string;
};

export type ConsistencyPattern = 'strong' | 'eventual' | 'causal' | 'session';

export type DataLineage = {
  source_entity: string;
  target_entity: string;
  transform?: string;
  frequency?: string;
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
  arch_style?: ArchStyle | null;
  business_processes?: string[];
  data_entities?: string[];
  data_governance?: string[];
  slo_availability_pct?: number | null;
  slo_latency_p99_ms?: number | null;
  critical_path_edge_ids?: string[];
  failure_modes?: FailureMode[];
  // P1.1: Dados Profundos
  data_ownership?: DataOwnership[];
  api_contracts?: ApiContract[];
  event_topics?: EventTopic[];
  consistency_patterns?: Record<string, ConsistencyPattern>;
  data_lineage?: DataLineage[];
  rpo_hours?: number | null;
  rto_minutes?: number | null;
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
  project_id?: string | null;
  owner_team?: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  name: string;
  context?: string;
  nfr?: ProjectNfr | null;
  diagrams: GraphRecord[];
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

export type CatalogCategory = "language" | "framework" | "library" | "service" | "database" | "platform" | "tool" | "security";

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
  /** Provedor cloud (multi-cloud) */
  provider?: CloudProvider;
  /** Capability para paridade AWS/Azure/GCP */
  capability?: string;
  /** Limites de capacidade (RPS, conexões, throughput) */
  limits?: {
    max_rps?: number;
    max_connections?: number;
    max_throughput_mbps?: number;
  };
  /** Modelo de alta disponibilidade */
  ha_model?: "single-az" | "multi-az" | "multi-region" | "global";
  /** Regiões disponíveis */
  regions?: string[];
  /** Tier de pricing (free, basic, standard, premium, enterprise) */
  pricing_tier?: "free" | "basic" | "standard" | "premium" | "enterprise";
  /** Recomendação de RPS baseada em benchmarks */
  rps_guidance?: string;
  /** SLA garantido (%) */
  sla_pct?: number;
  /** Tempo médio de recuperação (minutos) */
  mttr_minutes?: number;
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
  jira_key?: string;
  confluence_url?: string;
};

export type ReviewTemplateItem = {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
};

/** P2.2.4 — view salva (filtros + camada) por usuário/diagrama */
export type SavedView = {
  id: string;
  name: string;
  tags: string[];
  filter: import("./canvas-filter").CanvasFilter;
  created_at: string;
  updated_at: string;
};

/** P2.2.3 — permissão por squad em um grafo */
export type TeamAccess = {
  team: string;
  role: "read" | "write" | "admin";
};
