import type {
  AnalysisResult,
  CircuitBreakersResult,
  GraphRecord,
  GraphVersion,
  Project,
  ReviewStatus,
  UserRole,
  NodeComment,
} from "./types";
import type {
  OutputFormat,
  PresetRunPayload,
  SimulationPreset,
  SimulationResult,
} from "./simulation";
import { API_BASE } from "./api-base";

// Item 41 — badge de uso diário da IA: cache em memória de 60s para não
// martelar /settings/ai/usage a cada abertura do painel.
const AI_USAGE_CACHE_TTL_MS = 60_000;
let aiUsageCache: { at: number; value: AiUsage } | null = null;

async function fetchAiUsage(): Promise<AiUsage> {
  const now = Date.now();
  if (aiUsageCache && now - aiUsageCache.at < AI_USAGE_CACHE_TTL_MS) {
    return aiUsageCache.value;
  }
  const value = await request<AiUsage>("/api/v1/settings/ai/usage");
  aiUsageCache = { at: now, value };
  return value;
}

export class ApiConflictError extends Error {
  readonly status = 409;
  readonly serverEtag: string | null;
  readonly updatedAt: string | null;

  constructor(message: string, serverEtag: string | null = null, updatedAt: string | null = null) {
    super(message);
    this.name = "ApiConflictError";
    this.serverEtag = serverEtag;
    this.updatedAt = updatedAt;
  }
}

/**
 * Contrato (d) — 429 do rate limit de simulação/resiliência. O backend
 * responde com header `Retry-After` (janela em segundos: 5/60s simulação,
 * 30/60s resiliência); `retryAfter` é SEMPRE number (fallback 60 quando o
 * header ausente/inválido — a janela padrão do backend).
 */
export class ApiRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "ApiRateLimitError";
    this.retryAfter = retryAfter;
  }
}

const DEFAULT_RETRY_AFTER_S = 60;

function readRetryAfter(response: Response): number {
  const header = response.headers.get("Retry-After");
  if (header != null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }
  return DEFAULT_RETRY_AFTER_S;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    let serverEtag: string | null = response.headers.get("ETag");
    let updatedAt: string | null = null;
    try {
      const body = (await response.json()) as {
        detail?: string | { code?: string; message?: string; server_etag?: string; updated_at?: string };
      };
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (body.detail && typeof body.detail === "object") {
        detail = body.detail.message || detail;
        serverEtag = body.detail.server_etag ?? serverEtag;
        updatedAt = body.detail.updated_at ?? null;
      }
    } catch {
      /* corpo não-JSON (429/413 de rate limit) — mantém o detail de status */
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail, readRetryAfter(response));
    }
    if (response.status === 409) {
      throw new ApiConflictError(detail, serverEtag, updatedAt);
    }
    throw new Error(detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const data = (await response.json()) as T;
  // Attach ETag for optimistic concurrency when present
  const etag = response.headers.get("ETag");
  if (etag && data && typeof data === "object") {
    (data as { etag?: string }).etag = etag;
  }
  return data;
}

/**
 * Export csv/prometheus (contrato (d)): fetch BRUTO — o corpo não é JSON
 * (text/csv | text/plain com Content-Disposition attachment; filename
 * `sim-{seed}-{mode}.{csv|prom}`). Devolve o `Response` para o chamador
 * tratar (blob/text()). 429 → ApiRateLimitError, mesmo tratamento de
 * request<T>.
 */
async function postSimulationExport(
  payload: PresetRunPayload,
  format: "csv" | "prometheus",
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`${API_BASE}/api/v1/simulations/run-preset`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    // `format` DEPOIS do spread: o parâmetro explícito vence sobre
    // `payload.output_format` (contrato (d)).
    body: JSON.stringify({ ...payload, output_format: format }),
    signal,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      /* corpo não-JSON — mantém o detail de status */
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail, readRetryAfter(response));
    }
    throw new Error(detail);
  }
  return response;
}

export type GraphPayload = {
  name: string;
  context?: string;
  nfr?: import("./types").ProjectNfr | null;
  nodes: unknown[];
  edges: unknown[];
  project_id?: string | null;
  owner_team?: string | null;
  diagram_kind?: string | null;
  parent_graph_id?: string | null;
  c4_parent_node_id?: string | null;
  excalidraw_elements?: unknown[] | null;
};

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  listGraphs: () => request<GraphRecord[]>("/api/v1/graphs"),
  getGraph: (id: string) => request<GraphRecord>(`/api/v1/graphs/${id}`),
  createGraph: (payload: GraphPayload) =>
    request<GraphRecord>("/api/v1/graphs", { method: "POST", body: JSON.stringify(payload) }),
  updateGraph: (
    id: string,
    payload: Partial<GraphPayload> & { analysis?: AnalysisResult | null },
    opts?: { ifMatch?: string | null; force?: boolean },
  ) =>
    request<GraphRecord>(`/api/v1/graphs/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers:
        !opts?.force && opts?.ifMatch
          ? { "If-Match": opts.ifMatch }
          : undefined,
    }),
  deleteGraph: (id: string) =>
    request<void>(`/api/v1/graphs/${id}`, { method: "DELETE" }),
  analyze: (payload: GraphPayload & { persist_id?: string | null }, signal?: AbortSignal) =>
    request<AnalysisResult>("/api/v1/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),
  analyzeGraph: (id: string, signal?: AbortSignal) =>
    request<AnalysisResult>(`/api/v1/graphs/${id}/analyze`, { method: "POST", signal }),
  listVersions: (id: string) => request<GraphVersion[]>(`/api/v1/graphs/${id}/versions`),
  restoreVersion: (id: string, versionId: string) =>
    request<GraphRecord>(`/api/v1/graphs/${id}/versions/${versionId}/restore`, { method: "POST" }),
  review: (id: string, body: { role: UserRole; status: ReviewStatus; comment: string }) =>
    request<GraphRecord>(`/api/v1/graphs/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  compare: (left: GraphPayload, right: GraphPayload) =>
    request<{
      left: AnalysisResult;
      right: AnalysisResult;
      comparison: {
        score_delta: number;
        cheaper: "left" | "right" | "tie";
        simpler: "left" | "right" | "tie";
        notes: string[];
      };
    }>("/api/v1/compare", { method: "POST", body: JSON.stringify({ left, right }) }),
  getAiSettings: () => request<AiSettings>("/api/v1/settings/ai"),
  // Item 41 — uso do dia (orçamento de IA); cache em memória de 60s no módulo.
  getAiUsage: () => fetchAiUsage(),
  updateAiSettings: (payload: AiSettingsUpdate) =>
    request<AiSettings>("/api/v1/settings/ai", { method: "PUT", body: JSON.stringify(payload) }),
  testAiSettings: (draft?: AiSettingsDraft) =>
    request<{ ok: boolean; detail: string; latency_ms: number | null }>("/api/v1/settings/ai/test", {
      method: "POST",
      ...(draft ? { body: JSON.stringify(draft) } : {}),
    }),
  listSimulationPresets: () => request<SimulationPreset[]>("/api/v1/simulations/presets"),
  // Ruling documentado (item 16/20): o método morto `runSimulation`
  // (POST /api/v1/simulations/run, sem chamador) foi REMOVIDO do client —
  // o endpoint continua existindo no backend; só o client não o expõe.
  runSimulationPreset: (payload: PresetRunPayload, signal?: AbortSignal) =>
    request<SimulationResult>("/api/v1/simulations/run-preset", {
      method: "POST",
      body: JSON.stringify({ output_format: "json" satisfies OutputFormat, ...payload }),
      signal,
    }),
  /** Contrato (d): export csv/prometheus → Response bruto (nada de JSON). */
  exportSimulation: (payload: PresetRunPayload, format: "csv" | "prometheus", signal?: AbortSignal) =>
    postSimulationExport(payload, format, signal),
  /**
   * P1 (item 8/15) — roda um cenário SALVO contra os nodes/edges atuais do
   * grafo (endpoint novo POST /graphs/{id}/simulation-scenarios/{sid}/run).
   */
  runScenario: (graphId: string, scenarioId: string, signal?: AbortSignal) =>
    request<SimulationResult>(
      `/api/v1/graphs/${graphId}/simulation-scenarios/${scenarioId}/run`,
      { method: "POST", signal },
    ),
  // Projects
  listProjects: (filters?: {
    search?: string;
    sort_by?: "recent" | "heaviest" | "name";
    archived?: boolean;
    pinned_first?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.sort_by) params.set("sort_by", filters.sort_by);
    if (filters?.archived != null) params.set("archived", String(filters.archived));
    if (filters?.pinned_first != null) params.set("pinned_first", String(filters.pinned_first));
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return request<{ items: Project[]; total: number; limit: number; offset: number; has_more: boolean }>(`/api/v1/projects${qs ? `?${qs}` : ""}`);
  },
  createProject: (payload: {
    name: string;
    description?: string;
    context?: string;
    nfr_json?: string;
    is_public?: boolean;
    project_kind?: string;
    access_list?: Array<{ email: string; role: "read" | "full" }>;
  }) =>
    request<Project>("/api/v1/projects", { method: "POST", body: JSON.stringify(payload) }),
  getProject: (id: string) => request<Project>(`/api/v1/projects/${id}`),
  updateProject: (id: string, payload: Partial<Project> & {
    access_list?: Array<{ email: string; role: "read" | "full" }>;
  }) =>
    request<Project>(`/api/v1/projects/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProject: (id: string) =>
    request<void>(`/api/v1/projects/${id}`, { method: "DELETE" }),
  archiveProject: (id: string) =>
    request<Project>(`/api/v1/projects/${id}/archive`, { method: "PATCH" }),
  pinProject: (id: string) =>
    request<Project>(`/api/v1/projects/${id}/pin`, { method: "PATCH" }),
  getProjectShareUrl: (id: string) =>
    request<{ share_url: string; share_token: string; is_public: boolean }>(
      `/api/v1/projects/${id}/share-url`,
    ),
  createGraphShare: (graphId: string) =>
    request<{ share_token: string; share_url: string; read_only: boolean }>(
      `/api/v1/share/graphs/${graphId}`,
      { method: "POST" },
    ),
  revokeGraphShare: (graphId: string) =>
    request<void>(`/api/v1/share/graphs/${graphId}`, { method: "DELETE" }),
  getSharedGraph: (token: string) =>
    request<{
      id: string;
      name: string;
      context: string;
      nodes: unknown[];
      edges: unknown[];
      read_only: boolean;
    }>(`/api/v1/share/${token}`),
  listAnnotations: (graphId: string, nodeId?: string) =>
    request<
      Array<{ id: string; graph_id: string; node_id: string | null; text: string; author: string; created_at: string }>
    >(`/api/v1/graphs/${graphId}/annotations${nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : ""}`),
  createAnnotation: (graphId: string, payload: { node_id: string; text: string }) =>
    request<{ id: string; graph_id: string; node_id: string | null; text: string; author: string; created_at: string }>(
      `/api/v1/graphs/${graphId}/annotations`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  deleteAnnotation: (graphId: string, annotationId: string) =>
    request<void>(`/api/v1/graphs/${graphId}/annotations/${annotationId}`, { method: "DELETE" }),
  listProjectDiagrams: (id: string) => request<GraphRecord[]>(`/api/v1/projects/${id}/diagrams`),
  createProjectDiagram: (projectId: string, payload: Partial<GraphRecord>) =>
    request<GraphRecord>(`/api/v1/projects/${projectId}/diagrams`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** Garante diagrama interno no projeto (cria se vazio; devolve o primario se ja existir). */
  autoInitProjectDiagram: (projectId: string) =>
    request<GraphRecord>(`/api/v1/projects/${projectId}/diagrams/auto-init`, {
      method: "POST",
    }),
  listSubsystems: () =>
    request<Array<{ id: string; name: string; owner_team?: string; node_count: number }>>("/api/v1/projects/subsystems"),
  importSubsystem: (
    projectId: string,
    payload: { subsystem_id: string; name?: string; owner_team?: string; merge_into_graph_id?: string },
  ) =>
    request<GraphRecord>(`/api/v1/projects/${projectId}/subsystems/import`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  graphDiff: (graphId: string, versionId: string) =>
    request<{
      summary: string;
      added_nodes: unknown[];
      removed_nodes: unknown[];
      changed_nodes: unknown[];
      added_edges: unknown[];
      removed_edges: unknown[];
    }>(`/api/v1/graphs/${graphId}/diff/${versionId}`),
  // Comments
  listComments: (graphId: string) => request<NodeComment[]>(`/api/v1/graphs/${graphId}/comments`),
  createComment: (
    graphId: string,
    payload: {
      node_id?: string;
      text: string;
      position_x?: number;
      position_y?: number;
      assignee?: string;
    },
  ) =>
    request<NodeComment>(`/api/v1/graphs/${graphId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteComment: (graphId: string, commentId: string) =>
    request<void>(`/api/v1/graphs/${graphId}/comments/${commentId}`, { method: "DELETE" }),
  updateComment: (
    graphId: string,
    commentId: string,
    payload: { text?: string; resolved?: boolean; assignee?: string },
  ) =>
    request<NodeComment>(`/api/v1/graphs/${graphId}/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  polyglotMap: (graphId: string) =>
    request<{
      services: Array<{ service: string; databases: Array<{ database_id: string; database_label: string; engine: string; pii_sensitivity: string }>; polyglot: boolean }>;
      shared_databases: Array<{ database_id: string; database_label: string; services: string[]; anti_pattern: boolean }>;
      summary: { service_count: number; database_count: number; shared_db_count: number; polyglot_services: number };
    }>(`/api/v1/graphs/${graphId}/polyglot-map`),
  lineage: (graphId: string) =>
    request<{
      lineage_edges: Array<{ source_label: string; target_label: string; transform?: string; origin?: string }>;
      entities: string[];
      edge_count: number;
    }>(`/api/v1/graphs/${graphId}/lineage`),
  listAuditEntries: (
    graphId: string,
    params: { limit?: number; offset?: number } = {},
  ) =>
    request<{ entries: Array<{ id: string; action: string; user_email: string; entity_type: string; entity_id: string | null; ip_address: string | null; created_at: string }>; total: number }>(
      `/api/v1/audit/${graphId}?limit=${params.limit ?? 20}&offset=${params.offset ?? 0}`,
    ),
  listSimulationScenarios: (graphId: string) =>
    request<import("./types").SimulationScenarioRecord[]>(`/api/v1/graphs/${graphId}/simulation-scenarios`),
  createSimulationScenario: (
    graphId: string,
    payload: { name: string; payload: import("./simulation").SimulationScenarioPayload },
  ) =>
    request<import("./types").SimulationScenarioRecord>(`/api/v1/graphs/${graphId}/simulation-scenarios`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteSimulationScenario: (graphId: string, scenarioId: string) =>
    request<void>(`/api/v1/graphs/${graphId}/simulation-scenarios/${scenarioId}`, { method: "DELETE" }),
  getEmbed: (graphId: string) =>
    request<{ graph_id: string; name: string; nodes: unknown[]; edges: unknown[]; read_only: boolean }>(
      `/api/v1/embed/${graphId}`,
    ),
  getEmbedToken: (graphId: string) =>
    request<{ embed_url: string; iframe_snippet: string }>(`/api/v1/embed/${graphId}/token`),
  // P2.2.3 — ACL por squad
  listAccess: (graphId: string, signal?: AbortSignal) =>
    request<Array<{ team: string; role: "read" | "write" | "admin" }>>(
      `/api/v1/graphs/${graphId}/access`,
      signal ? { signal } : undefined,
    ),
  setAccess: (graphId: string, team: string, role: "read" | "write" | "admin") =>
    request<{ team: string; role: string }>(`/api/v1/graphs/${graphId}/access`, {
      method: "POST",
      body: JSON.stringify({ team, role }),
    }),
  deleteAccess: (graphId: string, team: string) =>
    request<void>(`/api/v1/graphs/${graphId}/access/${team}`, { method: "DELETE" }),
  // P2.2.2 — contratos de borda entre subsystems
  listBoundaryContracts: (graphId: string, signal?: AbortSignal) =>
    request<Array<{ id: string; source_zone: string; target_zone: string; protocol: string; description: string; sla_ms?: number }>>(
      `/api/v1/graphs/${graphId}/boundary-contracts`,
      signal ? { signal } : undefined,
    ),
  createBoundaryContract: (graphId: string, body: { source_zone: string; target_zone: string; protocol?: string; description?: string; sla_ms?: number }) =>
    request<{ ok: boolean }>(`/api/v1/graphs/${graphId}/boundary-contracts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteBoundaryContract: (graphId: string, contractId: string) =>
    request<void>(`/api/v1/graphs/${graphId}/boundary-contracts/${contractId}`, { method: "DELETE" }),
  // Resiliência (contrato (d)): `signal` opcional em POSTs longos; `mode`
  // espelha o Literal do backend (FailureInjectionRequest).
  failureInjection: (
    graphId: string,
    body: { node_id: string; mode?: "down" | "timeout" | "degraded"; max_hops?: number },
    signal?: AbortSignal,
  ) =>
    request<import("./types").FailureInjectionResult>(`/api/v1/graphs/${graphId}/failure-injection`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  blastRadius: (
    graphId: string,
    body: { node_id: string; mode?: "down" | "timeout" | "degraded"; max_hops?: number },
    signal?: AbortSignal,
  ) =>
    request<import("./types").BlastRadiusResult>(`/api/v1/graphs/${graphId}/blast-radius`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  circuitBreakers: (graphId: string) =>
    request<CircuitBreakersResult>(`/api/v1/graphs/${graphId}/circuit-breakers`),
  costEstimate: (graphId: string, signal?: AbortSignal) =>
    request<import("./types").CostBreakdown>(`/api/v1/graphs/${graphId}/cost-estimate`, signal ? { signal } : undefined),
  /** Preview do custo com o canvas atual (sem salvar): POST com nodes/edges. */
  costEstimateLive: (
    graphId: string,
    payload: { nodes: unknown[]; edges: unknown[] },
    signal?: AbortSignal,
  ) =>
    request<import("./types").CostBreakdown>(`/api/v1/graphs/${graphId}/cost-estimate/live`, {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),
  liveDoc: (graphId: string) =>
    request<import("./types").LiveDocResult>(`/api/v1/graphs/${graphId}/doc`),
  networkPolicy: (graphId: string, signal?: AbortSignal) =>
    request<import("./types").NetworkPolicyResult>(
      `/api/v1/graphs/${graphId}/network-policy`,
      signal ? { signal } : undefined,
    ),
  deploymentFlows: (graphId: string, signal?: AbortSignal) =>
    request<import("./types").DeploymentFlowsResult>(
      `/api/v1/graphs/${graphId}/deployment-flows`,
      signal ? { signal } : undefined,
    ),
  /**
   * R7 (plano threat) — threat model heurístico do grafo SALVO
   * (GET; 429 → ApiRateLimitError, igual costEstimate). `nfr` no body
   * do live é opcional no wire (ausente → {} no backend).
   */
  threatAnalysis: (graphId: string, signal?: AbortSignal) =>
    request<import("./types").ThreatAnalysisResult>(
      `/api/v1/graphs/${graphId}/threat-analysis`,
      signal ? { signal } : undefined,
    ),
  threatAnalysisLive: (
    graphId: string,
    payload: { nodes: unknown[]; edges: unknown[]; nfr?: Record<string, unknown> },
    signal?: AbortSignal,
  ) =>
    request<import("./types").ThreatAnalysisResult>(
      `/api/v1/graphs/${graphId}/threat-analysis/live`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        signal,
      },
    ),
  projectConsistency: (projectId: string) =>
    request<{ ok: boolean; issues: unknown[]; graph_count: number }>(`/api/v1/projects/${projectId}/consistency`),
  projectPolicy: (projectId: string) =>
    request<{ ok: boolean; findings: unknown[] }>(`/api/v1/projects/${projectId}/policy`),
  projectRaci: (projectId: string) =>
    request<{ roles: string[]; rows: unknown[] }>(`/api/v1/projects/${projectId}/raci`),
  graphSlo: (graphId: string) =>
    request<{ services: unknown[]; error_budget: Record<string, unknown> }>(`/api/v1/graphs/${graphId}/slo`),
  graphBenchmark: (graphId: string, targetNodes = 500) =>
    request<Record<string, unknown>>(`/api/v1/graphs/${graphId}/benchmark?target_nodes=${targetNodes}`, {
      method: "POST",
    }),
  exportProjectAdrs: (projectId: string, adrs: unknown[]) =>
    request<{ written: string[]; count: number }>(`/api/v1/projects/${projectId}/adrs/export`, {
      method: "POST",
      body: JSON.stringify({ adrs }),
    }),
};

export type AiProvider = "omniroute" | "openai" | "anthropic" | "custom";

export type AiSettings = {
  provider: AiProvider;
  base_url: string;
  api_key_set: boolean;
  api_key_masked: string;
  model: string;
  enabled: boolean;
  /** Item 37 — consentimento para enviar dados do grafo a provedor externo. */
  llm_data_consent?: boolean;
  updated_at: string | null;
};

export type AiSettingsUpdate = {
  provider: AiProvider;
  base_url: string;
  api_key?: string;
  model: string;
  enabled: boolean;
  /** Item 37 — enviado no mesmo PUT que o restante da configuração. */
  llm_data_consent?: boolean;
};

/** Item 41 — uso do dia (orçamento de IA), shape exato do GET /settings/ai/usage. */
export type AiUsage = {
  day: string;
  analyze_used: number;
  auto_used: number;
  llm_calls: number;
  limit: number;
  auto_limit: number;
};

/**
 * Draft não salvo para "Testar conexão": o endpoint /settings/ai/test aceita
 * estes campos opcionais e usa a chave salva quando api_key é omitido.
 */
export type AiSettingsDraft = {
  provider: AiProvider;
  base_url: string;
  model: string;
  api_key?: string;
};
