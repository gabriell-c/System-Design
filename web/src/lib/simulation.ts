export type LoadType = "spike" | "constant" | "gradual" | "periodic";
export type TestMode = "load" | "stress" | "soak";
export type OutputFormat = "json" | "csv" | "prometheus";

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
  kind: string;
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
  kind: string;
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
  cascade_depth: number;
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
    }[];
    failure_scenarios: string[];
    recommendations: string[];
  } | null;
  export_body: string | null;
  export_content_type: string | null;
  presets_used: string[];
};

export type SimulationRunPayload = {
  name?: string;
  context?: string;
  nodes: unknown[];
  edges: unknown[];
  seed: number;
  realism_level: number;
  test_mode?: TestMode;
  load?: LoadScenario | null;
  journey?: UserJourney | null;
  events?: EventPattern[];
  output_format?: OutputFormat;
  include_timeline?: boolean;
};

export type PresetRunPayload = {
  preset_id: string;
  nodes: unknown[];
  edges: unknown[];
  context?: string;
  seed: number;
  realism_level: number;
  test_mode?: TestMode;
  output_format?: OutputFormat;
};
