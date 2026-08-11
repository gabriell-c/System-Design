import type { EnvironmentPlan, ProjectNfr } from "./types";

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
  };
}

export function nfrSummary(nfr: ProjectNfr): string {
  const parts: string[] = [];
  if (nfr.users_per_day != null) parts.push(`~${nfr.users_per_day}/dia`);
  if (nfr.budget_usd_month != null) parts.push(`US$${nfr.budget_usd_month}/mês`);
  if (nfr.availability_pct != null) parts.push(`${nfr.availability_pct}%`);
  if (nfr.latency_p99_ms != null) parts.push(`p99 ${nfr.latency_p99_ms}ms`);
  if (nfr.compliance.length) parts.push(nfr.compliance.join(", "));
  if (nfr.team_size != null) parts.push(`time ${nfr.team_size}`);
  return parts.join(" · ") || "NFRs ainda não preenchidos";
}
