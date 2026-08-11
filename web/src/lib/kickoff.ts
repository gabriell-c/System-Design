import type { Edge, Node } from "@xyflow/react";
import { isArchData, type CanvasNodeData, type KickoffItem, type ProjectNfr } from "./types";
import { emptyNfr } from "./nfr";

function kindsPresent(nodes: Node<CanvasNodeData>[]): Set<string> {
  const set = new Set<string>();
  for (const n of nodes) {
    if (isArchData(n.data)) set.add(n.data.kind);
  }
  return set;
}

function hasTech(nodes: Node<CanvasNodeData>[], ...needles: string[]): boolean {
  const blob = nodes
    .map((n) => {
      if (!isArchData(n.data)) return "";
      const c = n.data.config;
      return [n.data.tech, n.data.label, c.framework, c.engine, c.service, c.provider].filter(Boolean).join(" ");
    })
    .join(" ")
    .toLowerCase();
  return needles.some((n) => blob.includes(n.toLowerCase()));
}

/** Checklist de kickoff: o que falta para um projeto novo “de verdade”. */
export function buildKickoffChecklist(
  nodes: Node<CanvasNodeData>[],
  _edges: Edge[],
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
    id: "messaging",
    label: "Mensageria / async",
    detail: kinds.has("messaging")
      ? "Há fila/stream."
      : needsAsync
        ? "Escala/contexto sugerem processamento assíncrono."
        : "Opcional no MVP — ok se tudo for request/response.",
    status: kinds.has("messaging") ? "ok" : needsAsync ? "warn" : "ok",
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

  if (nfr.compliance.includes("LGPD") || /lgpd|dado pessoal/i.test(ctx)) {
    items.push({
      id: "lgpd",
      label: "LGPD / dados pessoais",
      detail: "Garanta criptografia, retenção e base legal — não só no papel.",
      status: hasTech(nodes, "cognito", "auth0", "keycloak") || nfr.compliance.includes("LGPD") ? "warn" : "warn",
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

export function kickoffScore(items: KickoffItem[]): { ok: number; total: number; ready: boolean } {
  const relevant = items.filter((i) => i.severity !== "info" || i.status !== "ok");
  const total = items.length;
  const ok = items.filter((i) => i.status === "ok").length;
  const blocking = items.filter((i) => i.status === "missing" && i.severity === "critical").length;
  return { ok, total, ready: blocking === 0 && ok >= Math.ceil(total * 0.6) };
}
