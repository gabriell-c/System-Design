/**
 * S3b (item 17) — espelho hand-written dos tipos de simulação do backend
 * (`backend/app/schemas/simulation.py`).
 *
 * RULING (documentado): sync MANUAL + teste de contrato (`src/lib/simulation.test.ts`)
 * em vez de openapi-typescript. Motivo: a tooling exigiria 1 dep dev nova
 * (openapi-typescript) + 1 script de codegen + 1 arquivo gerado sob controle
 * de versão, para um contrato de ~20 tipos que raramente muda; o custo de
 * sincronia manual é ~30 min quando o schema do backend muda, e o risco para
 * o release é menor (zero superfície nova de build/tooling). O teste de
 * contrato (fixtures em shape do backend atribuídos aos tipos + tsc no gate)
 * é o que trava a drift, não o codegen.
 *
 * Convenções do espelho:
 * - campo SEM default no Pydantic (required) → required no TS; campo COM
 *   default → optional no TS (rolling deploy: backend antigo pode não emitir).
 * - `SimulationScenarioPayload` espelha `extra="allow"` do backend (chaves
 *   free-form legadas são mantidas) → index signature.
 */

export type LoadType = "spike" | "constant" | "gradual" | "periodic";
export type TestMode = "load" | "stress" | "soak";
export type OutputFormat = "json" | "csv" | "prometheus";

/** S3b — whitelist fechada de métricas de validação (contrato S1a). */
export type ValidationMetric =
  | "capacity_rps"
  | "realism_score"
  | "peak_rps"
  | "error_rate_peak"
  | "avg_rps"
  | "conversion_rate";

/** S3b — kinds de passo de jornada (Literal do backend, default "browse"). */
export type JourneyStepKind =
  | "landing"
  | "browse"
  | "auth"
  | "read"
  | "write"
  | "checkout"
  | "payment"
  | "confirm";

export type LoadScenario = {
  name: string;
  description?: string;
  type: LoadType;
  requests_per_second: number;
  duration_seconds: number;
  burst_multiplier: number;
  concurrent_users: number;
};

export type JourneyStep = {
  id: string;
  name: string;
  /** S3b: agora Literal `JourneyStepKind` (antes string livre); default do
   *  backend é "browse" → optional. */
  kind?: JourneyStepKind;
  weight?: number;
  think_time_ms?: number;
  drop_off_rate?: number;
};

export type UserJourney = {
  name: string;
  steps: JourneyStep[];
  concurrent_users: number;
  think_time_ms?: number;
};

export type EventPattern = {
  event_type: string;
  trigger_probability: number;
  cascade_enabled: boolean;
  dependent_events: string[];
  severity: "info" | "warning" | "critical";
};

/** S3b (item 9 do backend) — regra de validação com métrica em whitelist
 *  fechada: valor fora da lista é 422 na rota e nunca chega ao engine. */
export type ValidationRule = {
  metric: ValidationMetric;
  min_value?: number | null;
  max_value?: number | null;
  required?: boolean;
};

export type SimulationPreset = {
  id: string;
  label: string;
  description: string;
  load: LoadScenario | null;
  journey: UserJourney | null;
  events: EventPattern[];
};

export type LoadPoint = {
  t_seconds: number;
  rps: number;
  error_rate: number;
  p95_ms: number;
  saturated: boolean;
};

export type Bottleneck = {
  /** Populado pelo backend (componente do gargalo, se houver nó dono). */
  node_id: string | null;
  component: string;
  reason: string;
  severity: "info" | "warning" | "critical";
  saturation_pct: number;
};

export type LoadReport = {
  scenario_name: string;
  type: LoadType;
  peak_rps: number;
  avg_rps: number;
  estimated_capacity_rps: number;
  saturation_at_seconds: number | null;
  error_rate_peak: number;
  bottlenecks: Bottleneck[];
  timeline: LoadPoint[];
  ok: boolean;
};

export type JourneyStepResult = {
  step_id: string;
  name: string;
  /** S3b: Literal `JourneyStepKind` (antes string livre). */
  kind: JourneyStepKind;
  entered: number;
  completed: number;
  dropped: number;
  success_rate: number;
  avg_latency_ms: number;
};

export type JourneyReport = {
  journey_name: string;
  concurrent_users: number;
  conversion_rate: number;
  steps: JourneyStepResult[];
  drop_off_hotspots: string[];
  ok: boolean;
};

export type TriggeredEvent = {
  event_type: string;
  triggered: boolean;
  roll: number;
  cascade: string[];
  impact: string;
  severity: "info" | "warning" | "critical";
};

export type EventReport = {
  triggered_count: number;
  events: TriggeredEvent[];
  /** S3b: renomeado de `cascade_depth` → `max_cascade_fanout` (contrato
   *  S1a): LARGURA máxima do leque de cascata, não profundidade. */
  max_cascade_fanout: number;
  ok: boolean;
};

export type ValidationResult = {
  metric: string;
  passed: boolean;
  actual: number | null;
  expected_min: number | null;
  expected_max: number | null;
  detail: string;
};

export type SimulationResult = {
  seed: number;
  realism_score: number;
  /** Calculado pelo service (backend): false quando realism_level > 0. */
  reproducible: boolean;
  estimated_capacity_rps: number;
  test_mode: TestMode;
  summary: string;
  load: LoadReport | null;
  journey: JourneyReport | null;
  events: EventReport | null;
  validations: ValidationResult[];
  validations_passed: boolean;
  findings: string[];
  engineering_audit?: {
    bottleneck_component: string | null;
    bottleneck_tech: string | null;
    bottleneck_rps: number;
    system_capacity_rps: number;
    headroom_pct: number;
    component_capacities: {
      component: string;
      tech: string;
      kind: string;
      capacity_rps: number;
      max_connections: number;
      utilization_pct: number;
      /** S3b: populado pelo backend (default False no schema). */
      is_bottleneck?: boolean;
    }[];
    failure_scenarios: string[];
    recommendations: string[];
  } | null;
  export_body: string | null;
  export_content_type: string | null;
  /** IDs dos presets que contribuíram com a run (vazio em run direto). */
  presets_used: string[];
};

export type PresetRunPayload = {
  preset_id: string;
  nodes: unknown[];
  edges: unknown[];
  name?: string;
  context?: string;
  seed: number;
  realism_level: number;
  test_mode?: TestMode;
  journey?: UserJourney | null;
  events?: EventPattern[];
  validation_rules?: ValidationRule[];
  include_timeline?: boolean;
  output_format?: OutputFormat;
};

/**
 * S3b (P1 / item 8) — payload tipado de cenário de simulação salvo em grafo.
 * Espelha `SimulationScenarioPayload` do backend: campos opcionais coerentes
 * com `SimulationRequest`/`PresetRunRequest`; `preset_id` presente → roda via
 * preset, ausente → engine em request direto. Chaves desconhecidas de
 * payload legado free-form são MANTIDAS pelo backend (`extra="allow"`) →
 * index signature aqui.
 */
export type SimulationScenarioPayload = {
  preset_id?: string | null;
  context?: string;
  name?: string | null;
  seed?: number;
  realism_level?: number;
  test_mode?: TestMode;
  output_format?: OutputFormat;
  load?: LoadScenario | null;
  journey?: UserJourney | null;
  events?: EventPattern[];
  validation_rules?: ValidationRule[];
  include_timeline?: boolean;
  /** Payloads legados free-form: chaves desconhecidas passam (extra="allow"). */
  [key: string]: unknown;
};
