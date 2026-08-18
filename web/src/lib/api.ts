import type {
  AnalysisResult,
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
  SimulationRunPayload,
} from "./simulation";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export type GraphPayload = {
  name: string;
  context?: string;
  nfr?: import("./types").ProjectNfr | null;
  nodes: unknown[];
  edges: unknown[];
};

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  listGraphs: () => request<GraphRecord[]>("/api/v1/graphs"),
  getGraph: (id: string) => request<GraphRecord>(`/api/v1/graphs/${id}`),
  createGraph: (payload: GraphPayload) =>
    request<GraphRecord>("/api/v1/graphs", { method: "POST", body: JSON.stringify(payload) }),
  updateGraph: (id: string, payload: Partial<GraphPayload> & { analysis?: AnalysisResult | null }) =>
    request<GraphRecord>(`/api/v1/graphs/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGraph: (id: string) =>
    request<void>(`/api/v1/graphs/${id}`, { method: "DELETE" }),
  analyze: (payload: GraphPayload & { persist_id?: string | null }) =>
    request<AnalysisResult>("/api/v1/analyze", { method: "POST", body: JSON.stringify(payload) }),
  analyzeGraph: (id: string) =>
    request<AnalysisResult>(`/api/v1/graphs/${id}/analyze`, { method: "POST" }),
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
  updateAiSettings: (payload: AiSettingsUpdate) =>
    request<AiSettings>("/api/v1/settings/ai", { method: "PUT", body: JSON.stringify(payload) }),
  testAiSettings: () =>
    request<{ ok: boolean; detail: string; latency_ms: number | null }>("/api/v1/settings/ai/test", {
      method: "POST",
    }),
  listSimulationPresets: () => request<SimulationPreset[]>("/api/v1/simulations/presets"),
  runSimulation: (payload: SimulationRunPayload) =>
    request<SimulationResult>("/api/v1/simulations/run", {
      method: "POST",
      body: JSON.stringify({ output_format: "json" satisfies OutputFormat, ...payload }),
    }),
  runSimulationPreset: (payload: PresetRunPayload) =>
    request<SimulationResult>("/api/v1/simulations/run-preset", {
      method: "POST",
      body: JSON.stringify({ output_format: "json" satisfies OutputFormat, ...payload }),
    }),
  // Projects
  listProjects: () => request<Project[]>("/projects"),
  createProject: (payload: { name: string; context?: string; nfr_json?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (id: string, payload: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
  listProjectDiagrams: (id: string) => request<GraphRecord[]>(`/projects/${id}/diagrams`),
  createProjectDiagram: (projectId: string, payload: Partial<GraphRecord>) =>
    request<GraphRecord>(`/projects/${projectId}/diagrams`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Comments
  listComments: (graphId: string) => request<NodeComment[]>(`/graphs/${graphId}/comments`),
  createComment: (graphId: string, payload: { node_id?: string; text: string }) =>
    request<NodeComment>(`/graphs/${graphId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteComment: (graphId: string, commentId: string) =>
    request<void>(`/graphs/${graphId}/comments/${commentId}`, { method: "DELETE" }),
};

export type AiProvider = "omniroute" | "openai" | "anthropic" | "custom";

export type AiSettings = {
  provider: AiProvider;
  base_url: string;
  api_key_set: boolean;
  api_key_masked: string;
  model: string;
  enabled: boolean;
  updated_at: string | null;
};

export type AiSettingsUpdate = {
  provider: AiProvider;
  base_url: string;
  api_key?: string;
  model: string;
  enabled: boolean;
};
