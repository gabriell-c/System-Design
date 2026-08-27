export type NodeKind =
  | "frontend"
  | "backend"
  | "database"
  | "cloud"
  | "identity"
  | "observability"
  | "integration"
  | "deploy"
  | "security"
  | "network";

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
  "network",
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
  | "dr_region"
  | "observability";

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
  "observability",
];

export type FlowKind = "sync" | "async" | "data" | "control" | "management";

export type FlowProtocol = "https" | "grpc" | "amqp" | "kafka" | "sql" | "s3" | "redis" | "other";

export type FailureBehavior = "retry" | "fallback" | "dlq" | "fail_fast" | "none";

export type CircuitBreakerConfig = {
  failure_threshold?: number;
  window_seconds?: number;
  fallback_target_id?: string;
  state?: "closed" | "open" | "half_open";
};

export type ArchEdgeData = {
  flowKind: FlowKind;
  protocol?: FlowProtocol;
  flowNumber?: number;
  label?: string;
  isCriticalPath?: boolean;
  failureBehavior?: FailureBehavior;
  firewallRules?: FirewallRule[];
  circuitBreaker?: CircuitBreakerConfig;
};

export type FirewallRule = {
  port: string;
  protocol: "tcp" | "udp" | "all";
  direction: "inbound" | "outbound";
  description?: string;
};

/** P2.3.1 — regra stateless de Network ACL. */
export type NaclRule = {
  rule_number: number;
  action: "allow" | "deny";
  protocol: "tcp" | "udp" | "icmp" | "all";
  port_range?: string;
  cidr?: string;
  direction: "inbound" | "outbound";
};

/** P2.3.1 — attachment de VPC ao Transit Gateway. */
export type TgwAttachment = {
  vpc_id: string;
  vpc_label?: string;
  route_table?: string;
  subnet_ids?: string[];
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
  | "soa"
  | "network"
  | "active_active";

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
  /** P0.5.6 — circuit breaker no nó */
  circuitBreaker?: CircuitBreakerConfig;
  /** P2.3.1 — regras SG quando catalogId = sec-sg */
  securityGroupRules?: FirewallRule[];
  /** P2.3.1 — regras NACL quando catalogId = net-nacl */
  naclRules?: NaclRule[];
  /** P2.3.1 — attachments TGW quando catalogId = net-tgw */
  tgwAttachments?: TgwAttachment[];
  /** Notas / especificações do card (HTML do editor rico). */
  notes?: string;
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
  /** P0.3.5 — CIDR na borda da zona/VPC */
  cidr?: string;
  /** P1.1.1 — bounded context name for DDD/data mesh */
  boundedContext?: string;
  score?: number | null;
  summary?: string;
  bottleneck?: boolean;
};

export type SwimlaneKind = "frontend" | "backend" | "database" | "dev_flow" | "user_flow";

export const ALL_SWIMLANE_KINDS: SwimlaneKind[] = [
  "frontend",
  "backend",
  "database",
  "dev_flow",
  "user_flow",
];

export type SwimlaneNodeData = {
  kind: "swimlane";
  swimlaneKind: SwimlaneKind;
  label: string;
  score?: number | null;
  summary?: string;
  bottleneck?: boolean;
};

/** P0.2.7 — sticky note no canvas. */
export type NoteNodeData = {
  kind: "note";
  label: string;
  text?: string;
  anchorNodeId?: string;
};

/** P0.3.5 — bloco CIDR explícito. */
export type CidrNodeData = {
  kind: "cidr";
  label: string;
  cidr: string;
  zoneKind?: ZoneKind;
};

/** P0.3.7 — boundary multi-tenant. */
export type TenantBoundaryData = {
  kind: "tenant_boundary";
  label: string;
  tenantMode: "pool" | "silo" | "bridge";
  tenantIds?: string[];
};

export type CanvasNodeData =
  | ArchNodeData
  | BlockNodeData
  | ZoneNodeData
  | SwimlaneNodeData
  | NoteNodeData
  | CidrNodeData
  | TenantBoundaryData
  | FreeNodeData;

export function isBlockData(data: CanvasNodeData): data is BlockNodeData {
  return data.kind === "block";
}

export function isZoneData(data: CanvasNodeData): data is ZoneNodeData {
  return data.kind === "zone";
}

export function isSwimlaneData(data: CanvasNodeData): data is SwimlaneNodeData {
  return data.kind === "swimlane";
}

export function isNoteData(data: CanvasNodeData): data is NoteNodeData {
  return data.kind === "note";
}

export function isCidrData(data: CanvasNodeData): data is CidrNodeData {
  return data.kind === "cidr";
}

export function isTenantBoundaryData(data: CanvasNodeData): data is TenantBoundaryData {
  return data.kind === "tenant_boundary";
}

export function isFreeData(data: CanvasNodeData): data is FreeNodeData {
  return (
    data.kind === "free-rectangle" ||
    data.kind === "free-circle" ||
    data.kind === "free-oval" ||
    data.kind === "free-diamond" ||
    data.kind === "free-triangle" ||
    data.kind === "free-hexagon" ||
    data.kind === "free-octagon" ||
    data.kind === "free-arrow-right" ||
    data.kind === "free-arrow-double" ||
    data.kind === "free-check" ||
    data.kind === "free-x" ||
    data.kind === "free-plus" ||
    data.kind === "free-text" ||
    data.kind === "free-edit" ||
    data.kind === "free-image" ||
    data.kind === "free-video" ||
    data.kind === "free-audio" ||
    data.kind === "free-note" ||
    data.kind === "free-link"
  );
}

export function isArchData(data: CanvasNodeData): data is ArchNodeData {
  return (
    data.kind !== "block" &&
    data.kind !== "zone" &&
    data.kind !== "swimlane" &&
    data.kind !== "note" &&
    data.kind !== "cidr" &&
    data.kind !== "tenant_boundary"
  );
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
  evidence_node_ids?: string[];
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
  /** P0.1.2 — tipo da vista no pacote */
  diagram_kind?: string | null;
  parent_graph_id?: string | null;
  c4_parent_node_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectAccessRole = "read" | "full";

export type ProjectAccessEntry = {
  email: string;
  role: ProjectAccessRole;
};

export type ProjectKind = "architecture" | "free";

export type FreeNodeKind =
  | "free-rectangle"
  | "free-circle"
  | "free-oval"
  | "free-diamond"
  | "free-triangle"
  | "free-hexagon"
  | "free-octagon"
  | "free-arrow-right"
  | "free-arrow-double"
  | "free-check"
  | "free-x"
  | "free-plus"
  | "free-text"
  | "free-edit"
  | "free-image"
  | "free-video"
  | "free-audio"
  | "free-note"
  | "free-link";

export const ALL_FREE_NODE_KINDS: FreeNodeKind[] = [
  "free-rectangle",
  "free-circle",
  "free-oval",
  "free-diamond",
  "free-triangle",
  "free-hexagon",
  "free-octagon",
  "free-arrow-right",
  "free-arrow-double",
  "free-check",
  "free-x",
  "free-plus",
  "free-text",
  "free-edit",
  "free-image",
  "free-video",
  "free-audio",
  "free-note",
  "free-link",
];

export type FreeBorderStyle = "solid" | "dashed" | "dotted";
export type FreeFontWeight = "normal" | "medium" | "bold";
export type FreeFontStyle = "normal" | "italic";
export type FreeTextAlign = "left" | "center" | "right";
export type FreeVerticalAlign = "top" | "center" | "bottom";
export type FreeShadow = "none" | "sm" | "md" | "lg" | "xl";
export type FreeFillPattern = "none" | "stripes" | "dots" | "checker";
export type FreeHoverEffect = "none" | "glow" | "scale" | "shadow";

export type FreeBackgroundGradient = {
  from: string;
  to: string;
  direction: "to-right" | "to-bottom" | "to-br" | "to-bl";
};

export type FreeNodeData = {
  kind: FreeNodeKind;
  label: string;
  text?: string;
  notes?: string;
  /** Higher values render on top. */
  layerOrder?: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderStyle?: FreeBorderStyle;
  opacity?: number;
  fontSize?: number;
  fontWeight?: FreeFontWeight;
  fontStyle?: FreeFontStyle;
  textAlign?: FreeTextAlign;
  verticalAlign?: FreeVerticalAlign;
  shadow?: FreeShadow;
  iconId?: string;
  iconSize?: number;
  backgroundGradient?: FreeBackgroundGradient;
  fillPattern?: FreeFillPattern;
  hoverEffect?: FreeHoverEffect;
  linkUrl?: string;
  mediaUrl?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  context?: string;
  nfr?: ProjectNfr | null;
  nfr_json?: string;
  is_public?: boolean;
  archived?: boolean;
  pinned?: boolean;
  project_kind?: ProjectKind;
  share_token?: string | null;
  access_list?: ProjectAccessEntry[];
  diagram_count?: number;
  node_count?: number;
  diagrams: GraphRecord[];
  created_at: string;
  updated_at: string;
};

export type ProjectListFilters = {
  search?: string;
  sort_by?: "recent" | "heaviest" | "name";
  archived?: boolean;
  pinned_first?: boolean;
};

export type ProjectCreateInput = {
  name: string;
  description?: string;
  context?: string;
  nfr_json?: string;
  is_public?: boolean;
  project_kind?: ProjectKind;
  access_list?: ProjectAccessEntry[];
};

export type GraphVersion = {
  id: string;
  graph_id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  created_at: string;
};

export type CatalogCategory = "language" | "framework" | "library" | "service" | "database" | "platform" | "tool" | "security" | "network";

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

export type FailureInjectionResult = {
  ok: boolean;
  error?: string;
  failed_node_id?: string;
  failed_label?: string;
  mode?: string;
  mode_detail?: string;
  unreachable_node_ids?: string[];
  degraded_node_ids?: string[];
  fallback_activations?: Array<{ edge_behavior: string; from: string; to: string; detail: string }>;
  critical_path_broken?: number;
  critical_path_total?: number;
  journeys_broken_pct?: number;
  affected_node_ids?: string[];
  summary?: string;
};

export type BlastRadiusResult = FailureInjectionResult & {
  origin_node_id?: string;
  origin_label?: string;
  highlight_edge_ids?: string[];
  hops?: Record<string, string[]>;
};

export type CostBreakdown = {
  line_items: Array<{
    node_id: string;
    label: string;
    catalog_id: string;
    region: string;
    tier: string;
    cost_key: string;
    cost_usd_month: number;
  }>;
  total_usd_month: number;
  heuristic_total_usd_month: number;
  by_region: Record<string, number>;
  by_tier: Record<string, number>;
  node_count: number;
  summary: string;
};

export type LiveDocResult = {
  markdown: string;
  anchors: Record<string, string>;
  updated_at: string;
};

export type NetworkPolicyFinding = {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  node_id?: string;
  edge_id?: string;
};

export type NetworkPolicyResult = {
  ok: boolean;
  score: number;
  summary: {
    security_groups: number;
    nacls: number;
    transit_gateways: number;
    edges_analyzed: number;
  };
  findings: NetworkPolicyFinding[];
};

export type DeploymentFlowEdge = {
  id?: string;
  source: string;
  target: string;
  flow_number?: number;
  label?: string;
  flow_kind?: string;
};

export type DeploymentFlowsResult = {
  ok: boolean;
  dev_flow: { node_count: number; edge_count: number; edges: DeploymentFlowEdge[] };
  user_flow: { node_count: number; edge_count: number; edges: DeploymentFlowEdge[] };
  cross_flow: { edge_count: number; edges: DeploymentFlowEdge[] };
  gaps: { severity: string; detail: string }[];
};
