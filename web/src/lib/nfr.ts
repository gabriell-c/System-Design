import type { EnvironmentPlan, FailureMode, ProjectNfr } from "./types";

export const COMPLIANCE_OPTIONS = ["LGPD", "PCI-DSS", "HIPAA", "SOC2", "ISO27001"] as const;

export function emptyEnvironments(): EnvironmentPlan {
  return {
    has_dev: true,
    has_staging: false,
    has_prod: false,
    has_ci_cd: false,
    has_backups: false,
    has_monitoring_plan: false,
  };
}

function normalizeFailureModes(raw: unknown): FailureMode[] {
  if (!Array.isArray(raw)) return [];
  const out: FailureMode[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Partial<FailureMode>;
    if (
      typeof o.component_id === "string" &&
      typeof o.mode === "string" &&
      typeof o.impact === "string" &&
      typeof o.mitigation === "string"
    ) {
      out.push({
        component_id: o.component_id,
        mode: o.mode,
        impact: o.impact,
        mitigation: o.mitigation,
      });
    }
  }
  return out;
}

export function emptyNfr(): ProjectNfr {
  return {
    users_per_day: null,
    budget_usd_month: null,
    availability_pct: null,
    latency_p99_ms: null,
    compliance: [],
    team_size: null,
    deadline_weeks: null,
    environments: emptyEnvironments(),
    arch_style: null,
    business_processes: [],
    data_entities: [],
    data_governance: [],
    slo_availability_pct: null,
    slo_latency_p99_ms: null,
    critical_path_edge_ids: [],
    failure_modes: [],
  };
}

export function normalizeNfr(raw: unknown): ProjectNfr {
  const base = emptyNfr();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<ProjectNfr> & { environments?: Partial<EnvironmentPlan> };
  return {
    users_per_day: typeof o.users_per_day === "number" ? o.users_per_day : null,
    budget_usd_month: typeof o.budget_usd_month === "number" ? o.budget_usd_month : null,
    availability_pct: typeof o.availability_pct === "number" ? o.availability_pct : null,
    latency_p99_ms: typeof o.latency_p99_ms === "number" ? o.latency_p99_ms : null,
    compliance: Array.isArray(o.compliance) ? o.compliance.filter((c) => typeof c === "string") : [],
    team_size: typeof o.team_size === "number" ? o.team_size : null,
    deadline_weeks: typeof o.deadline_weeks === "number" ? o.deadline_weeks : null,
    environments: {
      ...emptyEnvironments(),
      ...(o.environments && typeof o.environments === "object" ? o.environments : {}),
    },
    arch_style: o.arch_style ?? null,
    business_processes: Array.isArray(o.business_processes)
      ? o.business_processes.filter((x) => typeof x === "string")
      : [],
    data_entities: Array.isArray(o.data_entities) ? o.data_entities.filter((x) => typeof x === "string") : [],
    data_governance: Array.isArray(o.data_governance)
      ? o.data_governance.filter((x) => typeof x === "string")
      : [],
    slo_availability_pct: typeof o.slo_availability_pct === "number" ? o.slo_availability_pct : null,
    slo_latency_p99_ms: typeof o.slo_latency_p99_ms === "number" ? o.slo_latency_p99_ms : null,
    critical_path_edge_ids: Array.isArray(o.critical_path_edge_ids)
      ? o.critical_path_edge_ids.filter((x) => typeof x === "string")
      : [],
    failure_modes: normalizeFailureModes(o.failure_modes),
  };
}

export function nfrSummary(nfr: ProjectNfr): string {
  const parts: string[] = [];
  if (nfr.users_per_day != null) parts.push(`~${nfr.users_per_day}/dia`);
  if (nfr.budget_usd_month != null) parts.push(`US$${nfr.budget_usd_month}/mês`);
  const avail = nfr.slo_availability_pct ?? nfr.availability_pct;
  const lat = nfr.slo_latency_p99_ms ?? nfr.latency_p99_ms;
  if (avail != null) parts.push(`${avail}%`);
  if (lat != null) parts.push(`p99 ${lat}ms`);
  if (nfr.compliance.length) parts.push(nfr.compliance.join(", "));
  if (nfr.team_size != null) parts.push(`time ${nfr.team_size}`);
  return parts.join(" · ") || "NFRs ainda não preenchidos";
}
