import type { Edge, Node } from "@xyflow/react";
import { createBlockNode } from "./blocks";
import { findCatalog } from "./catalog";
import { emptyNfr } from "./nfr";
import { ARCHITECTURE_TEMPLATES } from "./templates-architecture";
import { SCALE_TEMPLATES } from "./templates-scale";
import type { ProjectTemplate } from "./templates-types";
import type { CanvasNodeData, NodeKind } from "./types";

export type { ProjectTemplate } from "./templates-types";

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
  // ── 1. SaaS B2B ────────────────────────────────────────────────────────────
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
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 56 } },
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

  // ── 2. Marketplace ─────────────────────────────────────────────────────────
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
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 56 } },
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

  // ── 3. Fintech / Open Finance (PIX) ────────────────────────────────────────
  {
    id: "fintech-pix",
    label: "Fintech · PIX / Open Finance",
    description:
      "Next + FastAPI + Postgres + Kafka + Redis + Cognito + Stripe/MP + anti-fraude + obs completa. Compliance BACEN.",
    name: "Fintech PIX Open Finance",
    context:
      "Plataforma fintech com PIX, transferências, Open Finance, anti-fraude em tempo real e conciliação. " +
      "~100k usuários/dia, p99 <200ms, disponibilidade 99.99%. Compliance BACEN + LGPD + PCI-DSS. " +
      "Time de 8, 24 semanas, budget alto. Staging + CI/CD + backups + monitoramento obrigatórios.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 100000,
      budget_usd_month: 3000,
      availability_pct: 99.99,
      latency_p99_ms: 200,
      team_size: 8,
      deadline_weeks: 24,
      compliance: ["BACEN", "LGPD", "PCI-DSS"],
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
          { id: "blk-dep", domain: "deploy", position: { x: 900, y: 420 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-grpc", catalogId: "be-grpc", parentId: "blk-be", position: { x: 24, y: 150 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-es", catalogId: "db-elasticsearch", parentId: "blk-db", position: { x: 24, y: 244 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-sqs", catalogId: "int-sqs", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-stripe", catalogId: "int-stripe", parentId: "blk-int", position: { x: 24, y: 244 } },
          { id: "c-mp", catalogId: "int-mercadopago", parentId: "blk-int", position: { x: 24, y: 338 } },
          { id: "c-wh", catalogId: "int-webhook", parentId: "blk-int", position: { x: 250, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-lambda", catalogId: "cloud-aws-lambda", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-s3", catalogId: "cloud-aws-s3", parentId: "blk-cloud", position: { x: 250, y: 150 } },
          { id: "c-cog", catalogId: "id-cognito", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-secrets", catalogId: "mc-aws-secrets", parentId: "blk-id", position: { x: 24, y: 150 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-cw", catalogId: "obs-cloudwatch", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-sentry", catalogId: "obs-sentry", parentId: "blk-obs", position: { x: 24, y: 244 } },
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-tf", catalogId: "dep-terraform", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-k8s", catalogId: "dep-k8s", parentId: "blk-dep", position: { x: 24, y: 244 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-alb" },
          { id: "e2", source: "c-alb", target: "c-api" },
          { id: "e3", source: "c-api", target: "c-pg" },
          { id: "e4", source: "c-api", target: "c-redis" },
          { id: "e5", source: "c-api", target: "c-kafka" },
          { id: "e6", source: "c-api", target: "c-stripe" },
          { id: "e7", source: "c-api", target: "c-mp" },
          { id: "e8", source: "c-wh", target: "c-api" },
          { id: "e9", source: "c-kafka", target: "c-lambda" },
          { id: "e10", source: "c-lambda", target: "c-es" },
          { id: "e11", source: "c-api", target: "c-cog" },
          { id: "e12", source: "c-api", target: "c-secrets" },
          { id: "e13", source: "c-api", target: "c-sqs" },
          { id: "e14", source: "c-gh", target: "c-tf" },
          { id: "e15", source: "c-tf", target: "c-k8s" },
          { id: "e16", source: "c-k8s", target: "c-ecs" },
        ],
      ),
  },

  // ── 4. Video Streaming ─────────────────────────────────────────────────────
  {
    id: "video-streaming",
    label: "Video Streaming",
    description:
      "Next + Nest + Postgres + Redis + Kafka + S3 + CloudFront + Lambda + ElasticSearch + K8s. CDN + transcoding.",
    name: "Plataforma de Video Streaming",
    context:
      "Plataforma de streaming VOD/live com upload, transcoding assíncrono, CDN global, catálogo e recomendação. " +
      "~200k usuários/dia, p99 <500ms playback start, 99.9% availability. DRM + analytics. " +
      "Time de 6, 20 semanas, budget alto de CDN/compute.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 200000,
      budget_usd_month: 5000,
      availability_pct: 99.9,
      latency_p99_ms: 500,
      team_size: 6,
      deadline_weeks: 20,
      compliance: ["LGPD", "DRM"],
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
          { id: "blk-obs", domain: "observability", position: { x: 1340, y: 20 } },
          { id: "blk-dep", domain: "deploy", position: { x: 1340, y: 400 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-nest", catalogId: "be-nest", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-es", catalogId: "db-elasticsearch", parentId: "blk-db", position: { x: 24, y: 244 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-sqs", catalogId: "int-sqs", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-s3", catalogId: "cloud-aws-s3", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-cf", catalogId: "cloud-aws-cf", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-lambda", catalogId: "cloud-aws-lambda", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 250, y: 150 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 24, y: 244 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-graf", catalogId: "obs-grafana", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 244 } },
          { id: "c-k8s", catalogId: "dep-k8s", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-tf", catalogId: "dep-terraform", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 244 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-cf" },
          { id: "e2", source: "c-cf", target: "c-alb" },
          { id: "e3", source: "c-alb", target: "c-nest" },
          { id: "e4", source: "c-nest", target: "c-pg" },
          { id: "e5", source: "c-nest", target: "c-redis" },
          { id: "e6", source: "c-nest", target: "c-kafka" },
          { id: "e7", source: "c-nest", target: "c-s3" },
          { id: "e8", source: "c-kafka", target: "c-lambda" },
          { id: "e9", source: "c-lambda", target: "c-s3" },
          { id: "e10", source: "c-s3", target: "c-cf" },
          { id: "e11", source: "c-nest", target: "c-es" },
          { id: "e12", source: "c-nest", target: "c-sqs" },
          { id: "e13", source: "c-gh", target: "c-tf" },
          { id: "e14", source: "c-tf", target: "c-k8s" },
          { id: "e15", source: "c-k8s", target: "c-ecs" },
        ],
      ),
  },

  // ── 5. Marketplace Enterprise ──────────────────────────────────────────────
  {
    id: "marketplace-enterprise",
    label: "Marketplace Enterprise",
    description:
      "Next + Nest + Postgres + Redis + Kafka + RabbitMQ + ElasticSearch + Stripe + K8s. Multi-vendor em escala.",
    name: "Marketplace Multi-vendor Enterprise",
    context:
      "Marketplace multi-vendor com catálogo grande, busca, checkout, logística, rating e moderação. " +
      "~50k usuários/dia, p99 <300ms, 99.95% availability. LGPD + PCI-DSS. Time de 10, 24 semanas.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 50000,
      budget_usd_month: 2000,
      availability_pct: 99.95,
      latency_p99_ms: 300,
      team_size: 10,
      deadline_weeks: 24,
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
          { id: "blk-db", domain: "database", position: { x: 460, y: 400 } },
          { id: "blk-int", domain: "integration", position: { x: 900, y: 20 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 400 } },
          { id: "blk-id", domain: "identity", position: { x: 1340, y: 20 } },
          { id: "blk-obs", domain: "observability", position: { x: 1340, y: 400 } },
          { id: "blk-dep", domain: "deploy", position: { x: 900, y: 420 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-nest", catalogId: "be-nest", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-es", catalogId: "db-elasticsearch", parentId: "blk-db", position: { x: 24, y: 244 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-rabbit", catalogId: "int-rabbit", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-stripe", catalogId: "int-stripe", parentId: "blk-int", position: { x: 24, y: 244 } },
          { id: "c-mail", catalogId: "int-sendgrid", parentId: "blk-int", position: { x: 24, y: 338 } },
          { id: "c-wh", catalogId: "int-webhook", parentId: "blk-int", position: { x: 250, y: 56 } },
          { id: "c-cf", catalogId: "cloud-aws-cf", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-workers", catalogId: "cloud-cf-workers", parentId: "blk-cloud", position: { x: 250, y: 150 } },
          { id: "c-auth0", catalogId: "id-auth0", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-sentry", catalogId: "obs-sentry", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 244 } },
          { id: "c-k8s", catalogId: "dep-k8s", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-tf", catalogId: "dep-terraform", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 244 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-cf" },
          { id: "e2", source: "c-cf", target: "c-alb" },
          { id: "e3", source: "c-alb", target: "c-nest" },
          { id: "e4", source: "c-nest", target: "c-pg" },
          { id: "e5", source: "c-nest", target: "c-redis" },
          { id: "e6", source: "c-nest", target: "c-es" },
          { id: "e7", source: "c-nest", target: "c-kafka" },
          { id: "e8", source: "c-nest", target: "c-rabbit" },
          { id: "e9", source: "c-nest", target: "c-stripe" },
          { id: "e10", source: "c-wh", target: "c-nest" },
          { id: "e11", source: "c-nest", target: "c-mail" },
          { id: "e12", source: "c-nest", target: "c-auth0" },
          { id: "e13", source: "c-workers", target: "c-nest" },
          { id: "e14", source: "c-gh", target: "c-tf" },
          { id: "e15", source: "c-tf", target: "c-k8s" },
          { id: "e16", source: "c-k8s", target: "c-ecs" },
        ],
      ),
  },

  // ── 6. Telemedicina ────────────────────────────────────────────────────────
  {
    id: "telemedicina",
    label: "Telemedicina",
    description:
      "Next + FastAPI + Postgres + Redis + Kafka + S3 + Cognito + Twilio + obs. Prontuário, video e prescrição.",
    name: "Plataforma de Telemedicina",
    context:
      "Telemedicina com prontuário eletrônico, videoconsultas, prescrição digital, agenda e integrações lab/farmácia. " +
      "~10k usuários/dia, p99 <300ms, 99.9% availability. LGPD + HIPAA. Time de 5, 16 semanas.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 10000,
      budget_usd_month: 1500,
      availability_pct: 99.9,
      latency_p99_ms: 300,
      team_size: 5,
      deadline_weeks: 16,
      compliance: ["LGPD", "HIPAA"],
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
          { id: "blk-dep", domain: "deploy", position: { x: 900, y: 420 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-api", catalogId: "be-fastapi", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-twilio", catalogId: "int-twilio", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-ses", catalogId: "int-ses", parentId: "blk-int", position: { x: 24, y: 244 } },
          { id: "c-wh", catalogId: "int-webhook", parentId: "blk-int", position: { x: 24, y: 338 } },
          { id: "c-s3", catalogId: "cloud-aws-s3", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-cog", catalogId: "id-cognito", parentId: "blk-id", position: { x: 24, y: 56 } },
          { id: "c-secrets", catalogId: "mc-aws-secrets", parentId: "blk-id", position: { x: 24, y: 150 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-graf", catalogId: "obs-grafana", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-cw", catalogId: "obs-cloudwatch", parentId: "blk-obs", position: { x: 24, y: 244 } },
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-tf", catalogId: "dep-terraform", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-docker", catalogId: "dep-docker", parentId: "blk-dep", position: { x: 24, y: 244 } },
        ],
        [
          { id: "e1", source: "c-next", target: "c-alb" },
          { id: "e2", source: "c-alb", target: "c-api" },
          { id: "e3", source: "c-api", target: "c-pg" },
          { id: "e4", source: "c-api", target: "c-redis" },
          { id: "e5", source: "c-api", target: "c-kafka" },
          { id: "e6", source: "c-api", target: "c-twilio" },
          { id: "e7", source: "c-api", target: "c-s3" },
          { id: "e8", source: "c-api", target: "c-cog" },
          { id: "e9", source: "c-api", target: "c-secrets" },
          { id: "e10", source: "c-api", target: "c-ses" },
          { id: "e11", source: "c-wh", target: "c-api" },
          { id: "e12", source: "c-gh", target: "c-tf" },
          { id: "e13", source: "c-tf", target: "c-docker" },
          { id: "e14", source: "c-docker", target: "c-ecs" },
        ],
      ),
  },

  // ── 7. IoT Platform ────────────────────────────────────────────────────────
  {
    id: "iot-platform",
    label: "IoT Platform",
    description:
      "Next + Nest + InfluxDB + ClickHouse + Redis + NATS + Kafka + IoT Core + K8s. Telemetria em escala.",
    name: "Plataforma IoT em Escala",
    context:
      "Plataforma IoT com device management, telemetria streaming, rule engine e edge. " +
      "~500k devices, p99 <100ms no path de telemetria, 99.5% availability. Time de 6, 20 semanas.",
    nfr: {
      ...emptyNfr(),
      users_per_day: 500000,
      budget_usd_month: 4000,
      availability_pct: 99.5,
      latency_p99_ms: 100,
      team_size: 6,
      deadline_weeks: 20,
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
          { id: "blk-fe", domain: "frontend", position: { x: 20, y: 20 } },
          { id: "blk-be", domain: "backend", position: { x: 460, y: 20 } },
          { id: "blk-db", domain: "database", position: { x: 460, y: 400 } },
          { id: "blk-int", domain: "integration", position: { x: 900, y: 20 } },
          { id: "blk-cloud", domain: "cloud", position: { x: 20, y: 400 } },
          { id: "blk-obs", domain: "observability", position: { x: 1340, y: 20 } },
          { id: "blk-dep", domain: "deploy", position: { x: 1340, y: 400 } },
        ],
        [
          { id: "c-next", catalogId: "fe-next", parentId: "blk-fe", position: { x: 24, y: 56 } },
          { id: "c-nest", catalogId: "be-nest", parentId: "blk-be", position: { x: 24, y: 56 } },
          { id: "c-influx", catalogId: "db-influx", parentId: "blk-db", position: { x: 24, y: 56 } },
          { id: "c-ch", catalogId: "db-clickhouse", parentId: "blk-db", position: { x: 24, y: 150 } },
          { id: "c-redis", catalogId: "db-redis", parentId: "blk-db", position: { x: 24, y: 244 } },
          { id: "c-pg", catalogId: "db-postgres", parentId: "blk-db", position: { x: 250, y: 56 } },
          { id: "c-nats", catalogId: "int-nats", parentId: "blk-int", position: { x: 24, y: 56 } },
          { id: "c-kafka", catalogId: "int-kafka", parentId: "blk-int", position: { x: 24, y: 150 } },
          { id: "c-sns", catalogId: "int-sns", parentId: "blk-int", position: { x: 24, y: 244 } },
          { id: "c-iot", catalogId: "mc-aws-iot", parentId: "blk-cloud", position: { x: 24, y: 56 } },
          { id: "c-lambda", catalogId: "cloud-aws-lambda", parentId: "blk-cloud", position: { x: 24, y: 150 } },
          { id: "c-ecs", catalogId: "cloud-aws-ecs", parentId: "blk-cloud", position: { x: 250, y: 56 } },
          { id: "c-alb", catalogId: "cloud-aws-alb", parentId: "blk-cloud", position: { x: 250, y: 150 } },
          { id: "c-prom", catalogId: "obs-prometheus", parentId: "blk-obs", position: { x: 24, y: 56 } },
          { id: "c-graf", catalogId: "obs-grafana", parentId: "blk-obs", position: { x: 24, y: 150 } },
          { id: "c-otel", catalogId: "obs-otel", parentId: "blk-obs", position: { x: 24, y: 244 } },
          { id: "c-k8s", catalogId: "dep-k8s", parentId: "blk-dep", position: { x: 24, y: 56 } },
          { id: "c-tf", catalogId: "dep-terraform", parentId: "blk-dep", position: { x: 24, y: 150 } },
          { id: "c-gh", catalogId: "dep-ghactions", parentId: "blk-dep", position: { x: 24, y: 244 } },
        ],
        [
          { id: "e1", source: "c-iot", target: "c-nats" },
          { id: "e2", source: "c-nats", target: "c-lambda" },
          { id: "e3", source: "c-lambda", target: "c-kafka" },
          { id: "e4", source: "c-kafka", target: "c-influx" },
          { id: "e5", source: "c-kafka", target: "c-ch" },
          { id: "e6", source: "c-next", target: "c-alb" },
          { id: "e7", source: "c-alb", target: "c-nest" },
          { id: "e8", source: "c-nest", target: "c-pg" },
          { id: "e9", source: "c-nest", target: "c-redis" },
          { id: "e10", source: "c-nest", target: "c-influx" },
          { id: "e11", source: "c-nest", target: "c-ch" },
          { id: "e12", source: "c-lambda", target: "c-sns" },
          { id: "e13", source: "c-gh", target: "c-tf" },
          { id: "e14", source: "c-tf", target: "c-k8s" },
          { id: "e15", source: "c-k8s", target: "c-ecs" },
        ],
      ),
  },

  ...ARCHITECTURE_TEMPLATES,
  ...SCALE_TEMPLATES,
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
