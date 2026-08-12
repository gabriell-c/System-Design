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
  // ── 1. MVP barato ──────────────────────────────────────────────────────────
  {
    id: "mvp-barato",
    label: "MVP barato",
    description: "Next + FastAPI + Postgres + VPS + JWT + Docker. Ideal para validar ideia com budget mínimo.",
    name: "MVP barato",
    context:
      "MVP web para validar ideia de produto. Time de 1–2 devs, budget baixo (~US$40/mês), hospedagem simples em VPS. " +
      "Precisa de login, CRUD básico e deploy rápido em ~6–8 semanas. Sem multi-tenant, sem filas complexas.",
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
          { id: "blk-dep", domain: "deploy", position: { x: 1000, y: 380 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-vps", catalogId: "cloud-hostinger", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-jwt", catalogId: "id-jwt", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 56 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-api" },
          { id: "e2", source: "c-api", target: "c-pg" },
          { id: "e3", source: "c-api", target: "c-jwt" },
          { id: "e4", source: "c-api", target: "c-vps" },
          { id: "e5", source: "c-docker", target: "c-vps" },
        ],
      ),
  },

  // ── 2. SaaS B2B ────────────────────────────────────────────────────────────
  {
    id: "saas-b2b",
    label: "SaaS B2B",
    description: "Next + Nest + Postgres + Redis + Cognito + ECS + CI/CD + observabilidade. Pronto para multi-tenant.",
    name: "SaaS B2B",
    context:
      "SaaS B2B multi-tenant para clientes empresariais. Login corporativo (SSO/Cognito), dashboard, CRUD intenso. " +
      "Meta ~5k usuários ativos/dia, LGPD + SOC2, time de 4 devs, deadline de 16 semanas. Staging + CI/CD obrigatórios.",
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
          { id: "blk-db", domain: "database", position: { x: 480, y: 380 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 380 } },
          { id: "blk-id", domain: "identity", position: { x: 940, y: 20 } },
          { id: "blk-obs", domain: "observability", position: { x: 940, y: 380 } },
          { id: "blk-dep", domain: "deploy", position: { x: 1400, y: 20 } },
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
          { id: "c-gh", catalogId: "dep-github-actions", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 150 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-alb" },
          { id: "e2", source: "c-alb", target: "c-nest" },
          { id: "e3", source: "c-nest", target: "c-pg" },
          { id: "e4", source: "c-nest", target: "c-redis" },
          { id: "e5", source: "c-nest", target: "c-cog" },
          { id: "e6", source: "c-nest", target: "c-ecs" },
          { id: "e7", source: "c-gh", target: "c-docker" },
          { id: "e8", source: "c-docker", target: "c-ecs" },
        ],
      ),
  },

  // ── 3. Marketplace / E-commerce ────────────────────────────────────────────
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Next + FastAPI + Postgres + SQS + Stripe + CDN + Auth0. Checkout, webhooks e picos de campanha.",
    name: "Marketplace",
    context:
      "Marketplace com compradores e vendedores. Checkout com Stripe, webhooks de pagamento, e-mails transacionais, " +
      "picos em campanha (Black Friday). ~20k usuários/dia no lançamento. PCI-DSS + LGPD. Time de 6, 20 semanas.",
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
          { id: "blk-db", domain: "database", position: { x: 460, y: 380 } },
          { id: "blk-int", domain: "integration", position: { x: 900, y: 20 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 380 } },
          { id: "blk-id", domain: "identity", position: { x: 1340, y: 20 } },
          { id: "blk-obs", domain: "observability", position: { x: 1340, y: 380 } },
          { id: "blk-dep", domain: "deploy", position: { x: 900, y: 420 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          // Integrações: filas + pagamentos + e-mail + webhook
          { id: "c-sqs", catalogId: "int-sqs", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-stripe", catalogId: "int-stripe", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-mail", catalogId: "int-sendgrid", parentId: "blk-int", position: { x: 24, y: 244 } },
          { id: "c-wh", catalogId: "int-webhook", parentId: "blk-int", position: { x: 24, y: 338 } },
          { id: "c-cf", catalogId: "cloud-aws-cf", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-auth0", catalogId: "id-auth0", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-sentry", catalogId: "obs-sentry", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-gh", catalogId: "dep-github-actions", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 150 } },
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
          { id: "e9", source: "c-api", target: "c-auth0" },
          { id: "e10", source: "c-gh", target: "c-docker" },
          { id: "e11", source: "c-docker", target: "c-ecs" },
        ],
      ),
  },

  // ── 4. API interna ─────────────────────────────────────────────────────────
  {
    id: "api-interna",
    label: "API interna",
    description: "FastAPI + Postgres + Kafka + JWT + API Gateway. Sem frontend público — service-to-service.",
    name: "API interna",
    context:
      "API interna consumida por outros serviços da empresa. Sem UI pública. Auth service-to-service via JWT, " +
      "event streaming com Kafka, SLOs claros (p99 < 150ms). SOC2. Time de 3, 10 semanas.",
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
          { id: "blk-int", domain: "integration", position: { x: 520, y: 380 } },
          { id: "blk-obs", domain: "observability", position: { x: 80, y: 380 } },
          { id: "blk-id", domain: "identity", position: { x: 960, y: 60 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 960, y: 380 } },
          { id: "blk-dep", domain: "deploy", position: { x: 1400, y: 60 } },
        ],
        [
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-jwt", catalogId: "id-jwt", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-apigw", catalogId: "cloud-aws-apigw", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-gh", catalogId: "dep-github-actions", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 150 } },
        ],
        [
          { id: "e1", source: "c-apigw", target: "c-api" },
          { id: "e2", source: "c-api", target: "c-pg" },
          { id: "e3", source: "c-api", target: "c-kafka" },
          { id: "e4", source: "c-api", target: "c-jwt" },
          { id: "e5", source: "c-gh", target: "c-docker" },
          { id: "e6", source: "c-docker", target: "c-ecs" },
        ],
      ),
  },

  // ── 5. Landing page / Marketing site ──────────────────────────────────────
  {
    id: "landing-page",
    label: "Landing page",
    description: "Next + Vercel + Plausible + Resend. Site de conversão com analytics e e-mail. Zero backend.",
    name: "Landing page",
    context:
      "Landing page de conversão para campanha de marketing ou lançamento de produto. " +
      "Sem backend próprio — formulário via Resend/webhook. Analytics com Plausible. Deploy na Vercel. " +
      "Time de 1, budget quase zero, entrega em 2 semanas.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 2000,
      budget_usd_month: 20,
      availability_pct: 99.5,
      latency_p99_ms: 200,
      team_size: 1,
      deadline_weeks: 2,
      compliance: ["LGPD"],
      environments: {
        has_dev: true,
        has_staging: false,
        has_prod: true,
        has_ci_cd: true,
        has_backups: false,
        has_monitoring_plan: false,
      },
    },
    build: () =>
      assemble(
        [
          { id: "blk-fe", domain: "frontend", position: { x: 40, y: 40 } },
          { id: "blk-int", domain: "integration", position: { x: 520, y: 40 } },
          { id: "blk-dep", domain: "deploy", position: { x: 520, y: 380 } },
          { id: "blk-obs", domain: "observability", position: { x: 40, y: 380 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-resend", catalogId: "int-resend", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-plausible", catalogId: "int-plausible", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-vercel", catalogId: "dep-vercel", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-gh", catalogId: "dep-github-actions", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-sentry", catalogId: "obs-sentry", parentId: "blk-obs", position: { x: 24, y: 56 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-vercel" },
          { id: "e2", source: "c-next", target: "c-resend" },
          { id: "e3", source: "c-next", target: "c-plausible" },
          { id: "e4", source: "c-gh", target: "c-vercel" },
        ],
      ),
  },

  // ── 6. App mobile ──────────────────────────────────────────────────────────
  {
    id: "app-mobile",
    label: "App mobile",
    description: "React Native + FastAPI + Postgres + Firebase Auth + Coolify. App iOS/Android com backend próprio.",
    name: "App mobile",
    context:
      "Aplicativo mobile iOS e Android com backend próprio. Push notifications, auth via Firebase, " +
      "API REST com FastAPI. Deploy self-hosted com Coolify. Time de 3, budget moderado, 12 semanas.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 3000,
      budget_usd_month: 150,
      availability_pct: 99.5,
      latency_p99_ms: 400,
      team_size: 3,
      deadline_weeks: 12,
      compliance: ["LGPD"],
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
          { id: "blk-fe", domain: "frontend", position: { x: 40, y: 40 } },
          { id: "blk-be", domain: "backend", position: { x: 520, y: 40 } },
          { id: "blk-db", domain: "database", position: { x: 520, y: 380 } },
          { id: "blk-id", domain: "identity", position: { x: 980, y: 40 } },
          { id: "blk-int", domain: "integration", position: { x: 980, y: 380 } },
          { id: "blk-dep", domain: "deploy", position: { x: 40, y: 380 } },
          { id: "blk-obs", domain: "observability", position: { x: 1440, y: 40 } },
        ],
        [
          { id: "c-rn", catalogId: "fe-reactnative", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-firebase", catalogId: "id-firebase", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-sqs", catalogId: "int-sqs", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-coolify", catalogId: "dep-coolify", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-sentry", catalogId: "obs-sentry", parentId: "blk-obs", position: { x: 24, y: 56 } },
        ],
        [
          { id: "e1", source: "c-rn", target: "c-api" },
          { id: "e2", source: "c-api", target: "c-pg" },
          { id: "e3", source: "c-api", target: "c-redis" },
          { id: "e4", source: "c-api", target: "c-firebase" },
          { id: "e5", source: "c-api", target: "c-sqs" },
          { id: "e6", source: "c-docker", target: "c-coolify" },
        ],
      ),
  },

  // ── 7. Microserviços event-driven ─────────────────────────────────────────
  {
    id: "microservices",
    label: "Microserviços",
    description: "Nest + Kafka + Postgres + Redis + K8s + OTel. Arquitetura event-driven para alta escala.",
    name: "Microserviços event-driven",
    context:
      "Sistema de microserviços event-driven para alta escala. Comunicação assíncrona via Kafka, " +
      "orquestração em Kubernetes, observabilidade completa com OpenTelemetry. " +
      "~50k usuários/dia, time de 8, budget alto, 24 semanas. Multi-AZ, SOC2 + LGPD.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 50000,
      budget_usd_month: 2000,
      availability_pct: 99.95,
      latency_p99_ms: 100,
      team_size: 8,
      deadline_weeks: 24,
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
          { id: "blk-be", domain: "backend", position: { x: 460, y: 20 } },
          { id: "blk-db", domain: "database", position: { x: 460, y: 400 } },
          { id: "blk-int", domain: "integration", position: { x: 900, y: 20 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 400 } },
          { id: "blk-id", domain: "identity", position: { x: 1340, y: 20 } },
          { id: "blk-obs", domain: "observability", position: { x: 1340, y: 400 } },
          { id: "blk-dep", domain: "deploy", position: { x: 900, y: 400 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-nest", catalogId: "be-nest", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-rabbit", catalogId: "int-rabbit", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-cog", catalogId: "id-cognito", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-graf", catalogId: "obs-grafana", parentId: "blk-obs", position: { x: 24, y: 244 } },
          { id: "c-k8s", catalogId: "dep-k8s", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-gh", catalogId: "dep-github-actions", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 244 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-alb" },
          { id: "e2", source: "c-alb", target: "c-nest" },
          { id: "e3", source: "c-nest", target: "c-pg" },
          { id: "e4", source: "c-nest", target: "c-redis" },
          { id: "e5", source: "c-nest", target: "c-kafka" },
          { id: "e6", source: "c-nest", target: "c-cog" },
          { id: "e7", source: "c-gh", target: "c-docker" },
          { id: "e8", source: "c-docker", target: "c-k8s" },
          { id: "e9", source: "c-k8s", target: "c-ecs" },
        ],
      ),
  },
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
