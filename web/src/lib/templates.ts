import type { Edge, Node } from "@xyflow/react";
import { createBlockNode } from "./blocks";
import { findCatalog } from "./catalog";
import { emptyNfr } from "./nfr";
import type { CanvasNodeData, NodeKind, ProjectNfr } from "./types";

export type ProjectTemplate = {
  id: string;
  label: string;
  description: string;
  name: string;
  context: string;
  nfr: ProjectNfr;
  build: () => { nodes: Node<CanvasNodeData>[]; edges: Edge[] };
};

function card(
  id: string,
  catalogId: string,
  position: { x: number; y: number },
  parentId?: string,
): Node<CanvasNodeData> | null {
  const item = findCatalog(catalogId);
  if (!item) return null;
  return {
    id,
    type: "arch",
    position,
    parentId,
    extent: parentId ? "parent" : undefined,
    expandParent: parentId ? true : undefined,
    data: {
      kind: item.kind,
      label: item.label,
      catalogId: item.id,
      tech: item.tech,
      config: { ...item.defaults },
      score: null,
    },
  };
}

function assemble(
  blocks: { id: string; domain: NodeKind; position: { x: number; y: number } }[],
  cards: { id: string; catalogId: string; parentId: string; position: { x: number; y: number } }[],
  edges: Edge[],
): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const nodes: Node<CanvasNodeData>[] = [];
  for (const b of blocks) {
    nodes.push(createBlockNode(b.id, b.domain, b.position));
  }
  for (const c of cards) {
    const n = card(c.id, c.catalogId, c.position, c.parentId);
    if (n) nodes.push(n);
  }
  return { nodes, edges };
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "mvp-barato",
    label: "MVP barato",
    description: "Next + FastAPI + Postgres + VPS + JWT. Time pequeno, budget baixo.",
    name: "MVP barato",
    context:
      "MVP web para validar ideia. Time de 1–2 devs, budget baixo, hospedagem simples. Precisa de login, CRUD e deploy rápido em ~6–8 semanas.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 500,
      budget_usd_month: 40,
      availability_pct: 99,
      latency_p99_ms: 500,
      team_size: 2,
      deadline_weeks: 8,
      compliance: ["LGPD"],
      environments: {
        has_dev: true,
        has_staging: false,
        has_prod: true,
        has_ci_cd: false,
        has_backups: true,
        has_monitoring_plan: false,
      },
    },
    build: () =>
      assemble(
        [
          { id: "blk-fe", domain: "frontend", position: { x: 40, y: 40 } },
          { id: "blk-be", domain: "backend", position: { x: 520, y: 40 } },
          { id: "blk-db", domain: "database", position: { x: 520, y: 380 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 40, y: 380 } },
          { id: "blk-id", domain: "identity", position: { x: 1000, y: 40 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-vps", catalogId: "cloud-hostinger", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-jwt", catalogId: "id-jwt", parentId: "blk-id", position: { x: 24, y: 56 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-api" },
          { id: "e2", source: "c-api", target: "c-pg" },
          { id: "e3", source: "c-api", target: "c-jwt" },
          { id: "e4", source: "c-api", target: "c-vps" },
        ],
      ),
  },
  {
    id: "saas-b2b",
    label: "SaaS B2B",
    description: "Next + Nest + Postgres + Redis + Cognito + observabilidade + staging.",
    name: "SaaS B2B",
    context:
      "SaaS B2B multi-tenant. Clientes empresas, login corporativo, dashboard, CRUD intenso. Meta ~5k usuários ativos/dia, LGPD, time de 4.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 5000,
      budget_usd_month: 400,
      availability_pct: 99.5,
      latency_p99_ms: 300,
      team_size: 4,
      deadline_weeks: 16,
      compliance: ["LGPD", "SOC2"],
      environments: {
        has_dev: true,
        has_staging: true,
        has_prod: true,
        has_ci_cd: true,
        has_backups: true,
        has_monitoring_plan: true,
      },
    },
    build: () =>
      assemble(
        [
          { id: "blk-fe", domain: "frontend", position: { x: 20, y: 20 } },
          { id: "blk-be", domain: "backend", position: { x: 480, y: 20 } },
          { id: "blk-db", domain: "database", position: { x: 480, y: 360 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 360 } },
          { id: "blk-id", domain: "identity", position: { x: 940, y: 20 } },
          { id: "blk-obs", domain: "observability", position: { x: 940, y: 360 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-nest", catalogId: "be-nest", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-cog", catalogId: "id-cognito", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-graf", catalogId: "obs-grafana", parentId: "blk-obs", position: { x: 24, y: 150 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-alb" },
          { id: "e2", source: "c-alb", target: "c-nest" },
          { id: "e3", source: "c-nest", target: "c-pg" },
          { id: "e4", source: "c-nest", target: "c-redis" },
          { id: "e5", source: "c-nest", target: "c-cog" },
          { id: "e6", source: "c-nest", target: "c-ecs" },
        ],
      ),
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Front + API + filas + pagamentos + e-mail + CDN — jornadas de compra.",
    name: "Marketplace",
    context:
      "Marketplace com compradores e vendedores. Checkout, webhooks de pagamento, e-mails, picos em campanha. ~20k usuários/dia no lançamento.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 20000,
      budget_usd_month: 800,
      availability_pct: 99.9,
      latency_p99_ms: 250,
      team_size: 6,
      deadline_weeks: 20,
      compliance: ["LGPD", "PCI-DSS"],
      environments: {
        has_dev: true,
        has_staging: true,
        has_prod: true,
        has_ci_cd: true,
        has_backups: true,
        has_monitoring_plan: true,
      },
    },
    build: () =>
      assemble(
        [
          { id: "blk-fe", domain: "frontend", position: { x: 20, y: 20 } },
          { id: "blk-be", domain: "backend", position: { x: 460, y: 20 } },
          { id: "blk-db", domain: "database", position: { x: 460, y: 340 } },
          { id: "blk-msg", domain: "messaging", position: { x: 900, y: 20 } },
          { id: "blk-int", domain: "integration", position: { x: 900, y: 340 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 340 } },
          { id: "blk-id", domain: "identity", position: { x: 1340, y: 20 } },
          { id: "blk-obs", domain: "observability", position: { x: 1340, y: 340 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-sqs", catalogId: "msg-sqs", parentId: "blk-msg", position: { x: 24, y: 56 } },
          { id: "c-stripe", catalogId: "int-stripe", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-mail", catalogId: "int-sendgrid", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-wh", catalogId: "int-webhook", parentId: "blk-int", position: { x: 24, y: 244 } },
          { id: "c-cf", catalogId: "cloud-aws-cf", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-auth0", catalogId: "id-auth0", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-sentry", catalogId: "obs-sentry", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 150 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-cf" },
          { id: "e2", source: "c-cf", target: "c-alb" },
          { id: "e3", source: "c-alb", target: "c-api" },
          { id: "e4", source: "c-api", target: "c-pg" },
          { id: "e5", source: "c-api", target: "c-sqs" },
          { id: "e6", source: "c-api", target: "c-stripe" },
          { id: "e7", source: "c-wh", target: "c-api" },
          { id: "e8", source: "c-api", target: "c-mail" },
        ],
      ),
  },
  {
    id: "api-interna",
    label: "API interna",
    description: "Só backend + DB + fila + métricas. Sem frontend público.",
    name: "API interna",
    context:
      "API interna para outros serviços da empresa. Sem UI pública. Precisa de auth service-to-service, filas e SLOs claros.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 0,
      budget_usd_month: 200,
      availability_pct: 99.9,
      latency_p99_ms: 150,
      team_size: 3,
      deadline_weeks: 10,
      compliance: ["SOC2"],
      environments: {
        has_dev: true,
        has_staging: true,
        has_prod: true,
        has_ci_cd: true,
        has_backups: true,
        has_monitoring_plan: true,
      },
    },
    build: () =>
      assemble(
        [
          { id: "blk-be", domain: "backend", position: { x: 80, y: 60 } },
          { id: "blk-db", domain: "database", position: { x: 520, y: 60 } },
          { id: "blk-msg", domain: "messaging", position: { x: 520, y: 380 } },
          { id: "blk-obs", domain: "observability", position: { x: 80, y: 380 } },
          { id: "blk-id", domain: "identity", position: { x: 960, y: 60 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 960, y: 380 } },
        ],
        [
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-kafka", catalogId: "msg-kafka", parentId: "blk-msg", position: { x: 24, y: 56 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-jwt", catalogId: "id-jwt", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-apigw", catalogId: "cloud-aws-apigw", parentId: "blk-cloud", position: { x: 24, y: 150 } },
        ],
        [
          { id: "e1", source: "c-apigw", target: "c-api" },
          { id: "e2", source: "c-api", target: "c-pg" },
          { id: "e3", source: "c-api", target: "c-kafka" },
          { id: "e4", source: "c-api", target: "c-jwt" },
        ],
      ),
  },
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
