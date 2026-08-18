import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData, KickoffItem, ProjectNfr } from "./types";
import { emptyNfr } from "./nfr";
import { normalizeEdgeData } from "./edges";

function isArchNode(data: CanvasNodeData): boolean {
  return data.kind !== "block" && data.kind !== "zone";
}

function kindsPresent(nodes: Node<CanvasNodeData>[]): Set<string> {
  const set = new Set<string>();
  for (const n of nodes) {
    if (isArchNode(n.data)) set.add(n.data.kind);
  }
  return set;
}

function hasTech(nodes: Node<CanvasNodeData>[], ...needles: string[]): boolean {
  const blob = nodes
    .map((n) => {
      if (!isArchNode(n.data)) return "";
      const d = n.data as Extract<CanvasNodeData, { kind: string; tech?: string; config?: Record<string, string | undefined> }>;
      if (!("config" in d)) return "";
      const c = d.config ?? {};
      return [d.tech, d.label, c.framework, c.engine, c.service, c.provider].filter(Boolean).join(" ");
    })
    .join(" ")
    .toLowerCase();
  return needles.some((n) => blob.includes(n.toLowerCase()));
}

/** Checklist de kickoff + gate review-ready. */
export function buildKickoffChecklist(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  nfr: ProjectNfr = emptyNfr(),
  context = "",
): KickoffItem[] {
  const kinds = kindsPresent(nodes);
  const items: KickoffItem[] = [];
  const users = nfr.users_per_day ?? 0;
  const highScale = users >= 10_000;
  const ctx = context.trim();

  items.push({
    id: "context",
    label: "Contexto do produto",
    detail: ctx.length >= 40 ? "Brief preenchido." : "Descreva produto, público e restrições (mín. ~40 caracteres).",
    status: ctx.length >= 40 ? "ok" : "missing",
    severity: "warning",
  });

  items.push({
    id: "nfr-scale",
    label: "Escala esperada (NFR)",
    detail: nfr.users_per_day != null ? `${nfr.users_per_day} usuários/dia` : "Informe usuários/dia nos NFRs.",
    status: nfr.users_per_day != null ? "ok" : "missing",
    severity: "warning",
  });

  items.push({
    id: "frontend",
    label: "Cliente (Frontend)",
    detail: kinds.has("frontend") ? "Há UI no desenho." : "MVP web costuma ter um frontend.",
    status: kinds.has("frontend") ? "ok" : "warn",
    severity: "info",
  });

  items.push({
    id: "backend",
    label: "API / Backend",
    detail: kinds.has("backend") ? "Há backend." : "Sem API o sistema não processa regras de negócio.",
    status: kinds.has("backend") ? "ok" : "missing",
    severity: "critical",
  });

  items.push({
    id: "database",
    label: "Persistência",
    detail: kinds.has("database") || hasTech(nodes, "rds", "dynamo", "s3")
      ? "Há armazenamento."
      : "Quase todo produto precisa guardar estado.",
    status: kinds.has("database") || hasTech(nodes, "rds", "dynamo") ? "ok" : "missing",
    severity: "critical",
  });

  items.push({
    id: "identity",
    label: "Identidade / Auth",
    detail: kinds.has("identity")
      ? "Auth presente no canvas."
      : "Login/SSO não aparece — risco de “deixar pra depois”.",
    status: kinds.has("identity") ? "ok" : "missing",
    severity: "critical",
  });

  items.push({
    id: "observability",
    label: "Observabilidade",
    detail: kinds.has("observability") || nfr.environments.has_monitoring_plan
      ? "Monitoramento previsto."
      : "Sem logs/métricas/tracing você voa às cegas em produção.",
    status: kinds.has("observability") || nfr.environments.has_monitoring_plan ? "ok" : "missing",
    severity: highScale ? "critical" : "warning",
  });

  const needsAsync = highScale || /fila|async|evento|webhook|pedido/i.test(ctx);
  items.push({
    id: "integration-async",
    label: "Filas / async",
    detail: kinds.has("integration")
      ? "Há componente de integração."
      : needsAsync
        ? "Escala/contexto sugerem processamento assíncrono."
        : "Opcional no MVP — ok se tudo for request/response.",
    status: kinds.has("integration") ? "ok" : needsAsync ? "warn" : "ok",
    severity: "info",
  });

  items.push({
    id: "infra",
    label: "Onde roda (Infra)",
    detail: kinds.has("cloud") ? "Há runtime/cloud." : "Defina VPS, PaaS ou cloud.",
    status: kinds.has("cloud") ? "ok" : "missing",
    severity: "warning",
  });

  const env = nfr.environments;
  items.push({
    id: "envs",
    label: "Caminho até produção",
    detail: [
      env.has_dev ? "dev" : null,
      env.has_staging ? "staging" : null,
      env.has_prod ? "prod" : null,
      env.has_ci_cd ? "CI/CD" : null,
      env.has_backups ? "backups" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Marque ambientes e práticas nos NFRs.",
    status: env.has_prod && env.has_backups ? "ok" : env.has_prod ? "warn" : "missing",
    severity: "warning",
  });

  const hasAn = (nfr.business_processes?.length ?? 0) >= 1;
  items.push({
    id: "review-an",
    label: "Vista AN (processos)",
    detail: hasAn
      ? `${nfr.business_processes!.length} processo(s) de negócio.`
      : "Declare ≥1 processo de negócio para review-ready.",
    status: hasAn ? "ok" : "missing",
    severity: "critical",
  });

  const hasAd = (nfr.data_entities?.length ?? 0) >= 1;
  items.push({
    id: "review-ad",
    label: "Vista AD (entidades)",
    detail: hasAd
      ? `${nfr.data_entities!.length} entidade(s) de dados.`
      : "Declare ≥1 entidade de dados para review-ready.",
    status: hasAd ? "ok" : "missing",
    severity: "critical",
  });

  const numbered = edges
    .map((e) => normalizeEdgeData(e.data).flowNumber)
    .filter((n): n is number => typeof n === "number");
  const hasFlowStory = numbered.length >= 2;
  items.push({
    id: "review-flows",
    label: "Fluxos numerados",
    detail: hasFlowStory
      ? `${numbered.length} passos numerados no caminho.`
      : "Numere ≥2 arestas (história do request).",
    status: hasFlowStory ? "ok" : "missing",
    severity: "critical",
  });

  const critical =
    (nfr.critical_path_edge_ids?.length ?? 0) > 0 ||
    edges.some((e) => normalizeEdgeData(e.data).isCriticalPath);
  items.push({
    id: "review-critical-path",
    label: "Caminho crítico",
    detail: critical ? "Caminho crítico marcado." : "Marque isCriticalPath em pelo menos um fluxo.",
    status: critical ? "ok" : "missing",
    severity: "warning",
  });

  const hasFailure =
    (nfr.failure_modes?.length ?? 0) > 0 ||
    edges.some((e) => {
      const fb = normalizeEdgeData(e.data).failureBehavior;
      return Boolean(fb && fb !== "none");
    });
  items.push({
    id: "review-failure",
    label: "Modo de falha",
    detail: hasFailure
      ? "Failure mode / behavior documentado."
      : "Documente failure mode ou failureBehavior no caminho crítico.",
    status: hasFailure ? "ok" : "warn",
    severity: "warning",
  });

  const sloOk =
    nfr.slo_availability_pct != null ||
    nfr.availability_pct != null ||
    nfr.slo_latency_p99_ms != null ||
    nfr.latency_p99_ms != null;
  items.push({
    id: "review-slo",
    label: "SLO / NFR de qualidade",
    detail: sloOk ? "Disponibilidade ou latência definida." : "Defina disponibilidade % ou p99 ms.",
    status: sloOk ? "ok" : "missing",
    severity: "warning",
  });

  if (nfr.compliance.includes("LGPD") || /lgpd|dado pessoal/i.test(ctx)) {
    items.push({
      id: "lgpd",
      label: "LGPD / dados pessoais",
      detail: "Garanta criptografia, retenção e base legal — não só no papel.",
      status: "warn",
      severity: "warning",
    });
  }

  if (nfr.budget_usd_month != null && nfr.budget_usd_month < 30 && highScale) {
    items.push({
      id: "budget",
      label: "Orçamento vs escala",
      detail: `Budget US$${nfr.budget_usd_month}/mês com ${users}/dia pode ser irrealista na cloud “cheia”.`,
      status: "warn",
      severity: "warning",
    });
  }

  return items;
}

export function kickoffScore(items: KickoffItem[]): {
  ok: number;
  total: number;
  ready: boolean;
  reviewReady: boolean;
} {
  const total = items.length;
  const ok = items.filter((i) => i.status === "ok").length;
  const blocking = items.filter((i) => i.status === "missing" && i.severity === "critical").length;
  const reviewIds = new Set(["review-an", "review-ad", "review-flows", "observability", "review-slo"]);
  const reviewItems = items.filter((i) => reviewIds.has(i.id));
  const reviewReady =
    reviewItems.length > 0 &&
    reviewItems.every((i) => i.status === "ok" || (i.id === "observability" && i.status !== "missing"));
  return {
    ok,
    total,
    ready: blocking === 0 && ok >= Math.ceil(total * 0.6),
    reviewReady,
  };
}
