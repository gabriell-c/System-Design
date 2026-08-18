import type { Edge, Node } from "@xyflow/react";
import { buildArchEdge } from "./edges";
import { findCatalog } from "./catalog";
import { emptyNfr } from "./nfr";
import type { ProjectTemplate } from "./templates-types";
import type { ArchEdgeData, CanvasNodeData, ProjectNfr } from "./types";
import { createZoneNode } from "./zones";

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

function flow(
  id: string,
  source: string,
  target: string,
  flowNumber: number,
  opts?: Partial<ArchEdgeData>,
): Edge {
  return buildArchEdge({
    id,
    source,
    target,
    data: {
      flowNumber,
      flowKind: opts?.flowKind ?? "sync",
      protocol: opts?.protocol ?? "https",
      label: opts?.label,
      isCriticalPath: opts?.isCriticalPath,
      failureBehavior: opts?.failureBehavior,
    },
  });
}

const baseNfr = (partial: Partial<ProjectNfr>): ProjectNfr => ({
  ...emptyNfr(),
  ...partial,
  environments: {
    ...emptyNfr().environments,
    ...(partial.environments ?? {}),
    has_prod: true,
    has_monitoring_plan: true,
    has_backups: true,
    has_staging: true,
  },
  slo_availability_pct: partial.slo_availability_pct ?? partial.availability_pct ?? null,
  slo_latency_p99_ms: partial.slo_latency_p99_ms ?? partial.latency_p99_ms ?? null,
});

export const ARCHITECTURE_TEMPLATES: ProjectTemplate[] = [
  {
    id: "aws-serverless-api-authorizer",
    label: "AWS · API Serverless + Authorizer",
    description: "Route53 → WAF → API GW → Authorizer → Lambda privada → DynamoDB + S3 (via Lambda).",
    name: "Serverless API Authorizer",
    context:
      "API serverless com segurança na borda: DNS, WAF, API Gateway, authorizer com Secrets Manager, " +
      "backend Lambda em VPC privada e persistência DynamoDB + S3 (sem hop mágico storage→storage).",
    nfr: baseNfr({
      users_per_day: 50000,
      availability_pct: 99.9,
      latency_p99_ms: 300,
      team_size: 4,
      arch_style: "serverless",
      business_processes: ["Autenticar chamada API", "Processar request de negócio"],
      data_entities: ["API key / session", "Application records", "Object blobs"],
      data_governance: ["Segredos no Secrets Manager", "Dados sensíveis só em subnet privada"],
      critical_path_edge_ids: ["e2", "e3", "e5", "e6"],
      failure_modes: [
        {
          component_id: "c-lambda",
          mode: "cold start / timeout",
          impact: "Latência p99 sobe; 5xx na API",
          mitigation: "Provisioned concurrency + fail_fast no authorizer",
        },
      ],
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-edge", "plane", { x: 40, y: 40 }, { label: "Edge / Entry", provider: "aws" }),
        createZoneNode("z-sec", "security_boundary", { x: 40, y: 360 }, { label: "AuthZ", provider: "aws" }),
        createZoneNode("z-region", "region", { x: 480, y: 40 }, { label: "Region", provider: "aws" }),
        createZoneNode("z-vpc", "vpc", { x: 24, y: 56 }, {
          label: "VPC",
          provider: "aws",
          parentId: "z-region",
        }),
        createZoneNode("z-priv", "subnet_private", { x: 24, y: 56 }, {
          label: "Private subnet",
          provider: "aws",
          parentId: "z-vpc",
        }),
        createZoneNode("z-data", "layer", { x: 480, y: 420 }, { label: "Data", provider: "aws" }),
      ];
      const cards = [
        card("c-dns", "mc-aws-route53", { x: 24, y: 48 }, "z-edge"),
        card("c-waf", "mc-aws-waf", { x: 24, y: 140 }, "z-edge"),
        card("c-apigw", "cloud-aws-apigw", { x: 24, y: 232 }, "z-edge"),
        card("c-auth", "mc-aws-lambda-auth", { x: 24, y: 48 }, "z-sec"),
        card("c-sec", "mc-aws-secrets", { x: 24, y: 140 }, "z-sec"),
        card("c-lambda", "cloud-aws-lambda", { x: 24, y: 48 }, "z-priv"),
        card("c-ddb", "mc-aws-dynamodb", { x: 24, y: 48 }, "z-data"),
        card("c-s3", "cloud-aws-s3", { x: 250, y: 48 }, "z-data"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-dns", "c-waf", 1, { label: "DNS" }),
        flow("e2", "c-waf", "c-apigw", 2, { label: "HTTPS", isCriticalPath: true, failureBehavior: "fail_fast" }),
        flow("e3", "c-apigw", "c-auth", 3, { label: "authorize", isCriticalPath: true, failureBehavior: "fail_fast" }),
        flow("e4", "c-auth", "c-sec", 4, { label: "secrets", flowKind: "control" }),
        flow("e5", "c-apigw", "c-lambda", 5, { label: "invoke", isCriticalPath: true, failureBehavior: "retry" }),
        flow("e6", "c-lambda", "c-ddb", 6, {
          flowKind: "data",
          protocol: "other",
          label: "DynamoDB",
          isCriticalPath: true,
          failureBehavior: "retry",
        }),
        flow("e7", "c-lambda", "c-s3", 7, { flowKind: "data", protocol: "other", label: "S3 via Lambda" }),
      ];
      return { nodes, edges };
    },
  },
  {
    id: "aws-multi-az-app",
    label: "AWS · Multi-AZ App",
    description: "Edge + VPC com 2 AZs (público/privado) + RDS/S3 — HA explícito nos dois AZs.",
    name: "Multi-AZ Application",
    context:
      "Aplicação multi-AZ com ALB, compute em subnets privadas em AZ-a e AZ-b, RDS e S3 compartilhados.",
    nfr: baseNfr({
      users_per_day: 20000,
      availability_pct: 99.95,
      latency_p99_ms: 200,
      team_size: 6,
      arch_style: "layered",
      business_processes: ["Servir UI/API", "Persistir dados"],
      data_entities: ["User profiles", "App data"],
      data_governance: ["Backup RDS", "Multi-AZ failover"],
      critical_path_edge_ids: ["e2", "e3", "e5"],
      failure_modes: [
        {
          component_id: "c-ecs-a",
          mode: "AZ-a indisponível",
          impact: "Tráfego deve falhar para AZ-b via ALB",
          mitigation: "Target group multi-AZ + health checks",
        },
      ],
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-edge", "plane", { x: 40, y: 40 }, { label: "Edge", provider: "aws" }),
        createZoneNode("z-region", "region", { x: 320, y: 40 }, { label: "Region us-east-1", provider: "aws" }),
        createZoneNode("z-vpc", "vpc", { x: 24, y: 48 }, { label: "VPC", provider: "aws", parentId: "z-region" }),
        createZoneNode("z-aza", "availability_zone", { x: 24, y: 48 }, {
          label: "AZ-a",
          provider: "aws",
          parentId: "z-vpc",
        }),
        createZoneNode("z-azb", "availability_zone", { x: 380, y: 48 }, {
          label: "AZ-b",
          provider: "aws",
          parentId: "z-vpc",
        }),
        createZoneNode("z-pub-a", "subnet_public", { x: 16, y: 48 }, {
          label: "Public A",
          parentId: "z-aza",
        }),
        createZoneNode("z-priv-a", "subnet_private", { x: 16, y: 220 }, {
          label: "Private A",
          parentId: "z-aza",
        }),
        createZoneNode("z-pub-b", "subnet_public", { x: 16, y: 48 }, {
          label: "Public B",
          parentId: "z-azb",
        }),
        createZoneNode("z-priv-b", "subnet_private", { x: 16, y: 220 }, {
          label: "Private B",
          parentId: "z-azb",
        }),
        createZoneNode("z-data", "layer", { x: 320, y: 560 }, { label: "Data", provider: "aws" }),
      ];
      const cards = [
        card("c-r53", "mc-aws-route53", { x: 24, y: 48 }, "z-edge"),
        card("c-waf", "mc-aws-waf", { x: 24, y: 140 }, "z-edge"),
        card("c-alb", "cloud-aws-alb", { x: 24, y: 48 }, "z-pub-a"),
        card("c-ecs-a", "cloud-aws-ecs", { x: 24, y: 48 }, "z-priv-a"),
        card("c-ecs-b", "cloud-aws-ecs", { x: 24, y: 48 }, "z-priv-b"),
        card("c-rds", "cloud-aws-rds", { x: 24, y: 48 }, "z-data"),
        card("c-s3", "cloud-aws-s3", { x: 250, y: 48 }, "z-data"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-r53", "c-waf", 1, { label: "HTTPS" }),
        flow("e2", "c-waf", "c-alb", 2, { label: "HTTPS", isCriticalPath: true, failureBehavior: "fail_fast" }),
        flow("e3", "c-alb", "c-ecs-a", 3, { label: "AZ-a", isCriticalPath: true, failureBehavior: "fallback" }),
        flow("e4", "c-alb", "c-ecs-b", 4, { label: "AZ-b", failureBehavior: "fallback" }),
        flow("e5", "c-ecs-a", "c-rds", 5, {
          flowKind: "data",
          protocol: "sql",
          label: "SQL",
          isCriticalPath: true,
          failureBehavior: "retry",
        }),
        flow("e6", "c-ecs-b", "c-rds", 6, { flowKind: "data", protocol: "sql", label: "SQL", failureBehavior: "retry" }),
        flow("e7", "c-ecs-a", "c-s3", 7, { flowKind: "data", label: "HTTPS" }),
      ];
      return { nodes, edges };
    },
  },
  {
    id: "azure-data-pipeline",
    label: "Azure · Data Pipeline NLP",
    description: "Event Hubs + Blob → Functions → Text Analytics → MySQL → ML / Power BI (+ Key Vault).",
    name: "Azure Data + NLP Pipeline",
    context:
      "Pipeline event-driven: ingestão streaming/batch, enriquecimento NLP, persistência MySQL, consumo ML/BI, segredos no Key Vault.",
    nfr: baseNfr({
      users_per_day: 100000,
      availability_pct: 99.5,
      latency_p99_ms: 2000,
      team_size: 5,
      arch_style: "event_driven",
      business_processes: ["Ingerir eventos", "Enriquecer texto", "Analisar / reportar"],
      data_entities: ["Raw events", "Enriched records", "ML features"],
      data_governance: ["PII mascarada no enrich", "Retenção Blob 30d"],
      critical_path_edge_ids: ["e1", "e3", "e4"],
      failure_modes: [
        {
          component_id: "c-fn",
          mode: "poison message",
          impact: "Pipeline trava no enrich",
          mitigation: "DLQ no Event Hubs + retry com backoff",
        },
      ],
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-ingest", "plane", { x: 40, y: 80 }, { label: "Ingestion", provider: "azure" }),
        createZoneNode("z-proc", "plane", { x: 360, y: 80 }, { label: "Processing", provider: "azure" }),
        createZoneNode("z-store", "layer", { x: 680, y: 80 }, { label: "Persistence", provider: "azure" }),
        createZoneNode("z-consume", "plane", { x: 1000, y: 80 }, { label: "Consumption", provider: "azure" }),
        createZoneNode("z-sec", "security_boundary", { x: 40, y: 360 }, { label: "Identity / Secrets", provider: "azure" }),
      ];
      const cards = [
        card("c-eh", "mc-azure-eventhubs", { x: 24, y: 48 }, "z-ingest"),
        card("c-blob", "mc-azure-blob", { x: 24, y: 140 }, "z-ingest"),
        card("c-fn", "mc-azure-functions", { x: 24, y: 48 }, "z-proc"),
        card("c-nlp", "mc-azure-cognitive-text", { x: 24, y: 140 }, "z-proc"),
        card("c-mysql", "mc-azure-mysql", { x: 24, y: 48 }, "z-store"),
        card("c-ml", "mc-azure-ml", { x: 24, y: 48 }, "z-consume"),
        card("c-pbi", "mc-azure-powerbi", { x: 24, y: 140 }, "z-consume"),
        card("c-kv", "mc-azure-keyvault", { x: 24, y: 48 }, "z-sec"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-eh", "c-fn", 1, {
          flowKind: "async",
          protocol: "amqp",
          label: "stream",
          isCriticalPath: true,
          failureBehavior: "dlq",
        }),
        flow("e2", "c-blob", "c-fn", 2, { flowKind: "data", label: "batch" }),
        flow("e3", "c-fn", "c-nlp", 3, { label: "enrich", isCriticalPath: true, failureBehavior: "retry" }),
        flow("e4", "c-fn", "c-mysql", 4, {
          flowKind: "data",
          protocol: "sql",
          label: "SQL",
          isCriticalPath: true,
          failureBehavior: "retry",
        }),
        flow("e5", "c-mysql", "c-ml", 5, { flowKind: "data", protocol: "sql", label: "features" }),
        flow("e6", "c-mysql", "c-pbi", 6, { flowKind: "data", protocol: "sql", label: "SQL" }),
        flow("e7", "c-fn", "c-kv", 7, { flowKind: "control", label: "secrets" }),
      ];
      return { nodes, edges };
    },
  },
  {
    id: "aws-load-testing-control-data-plane",
    label: "AWS · Load Testing (control/data)",
    description: "Control plane orquestra Step Functions; data plane Fargate; telemetria CloudWatch + IoT.",
    name: "Distributed Load Testing",
    context:
      "Control plane (API + Step Functions) orquestra workers Fargate no data plane; estado/scripts em data layer; " +
      "telemetria live via CloudWatch e IoT Core (status, não “lixeira” genérica).",
    nfr: baseNfr({
      users_per_day: 500,
      availability_pct: 99.0,
      latency_p99_ms: 5000,
      team_size: 3,
      arch_style: "serverless",
      business_processes: ["Agendar teste", "Executar carga", "Coletar métricas"],
      data_entities: ["Test definition", "Run state", "Metrics"],
      data_governance: ["Métricas retidas 90d"],
      critical_path_edge_ids: ["e2", "e5", "e6"],
      failure_modes: [
        {
          component_id: "c-ecs",
          mode: "worker crash",
          impact: "Run incompleto",
          mitigation: "Step Functions retry + DLQ de status",
        },
      ],
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-control", "plane", { x: 40, y: 60 }, { label: "Control plane", provider: "aws" }),
        createZoneNode("z-data-plane", "plane", { x: 520, y: 60 }, { label: "Data plane (regional)", provider: "aws" }),
        createZoneNode("z-data", "layer", { x: 40, y: 360 }, { label: "Data stores", provider: "aws" }),
        createZoneNode("z-obs", "layer", { x: 520, y: 360 }, { label: "Observability / telemetry", provider: "aws" }),
      ];
      const cards = [
        card("c-cf", "cloud-aws-cf", { x: 24, y: 48 }, "z-control"),
        card("c-apigw", "cloud-aws-apigw", { x: 24, y: 140 }, "z-control"),
        card("c-sfn", "mc-aws-sfn", { x: 24, y: 232 }, "z-control"),
        card("c-ddb", "mc-aws-dynamodb", { x: 24, y: 48 }, "z-data"),
        card("c-s3", "cloud-aws-s3", { x: 250, y: 48 }, "z-data"),
        card("c-ecs", "cloud-aws-ecs", { x: 24, y: 48 }, "z-data-plane"),
        card("c-lambda", "cloud-aws-lambda", { x: 24, y: 140 }, "z-data-plane"),
        card("c-cw", "mc-aws-cloudwatch", { x: 24, y: 48 }, "z-obs"),
        card("c-iot", "mc-aws-iot", { x: 250, y: 48 }, "z-obs"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-cf", "c-apigw", 1, { flowKind: "control", label: "HTTPS" }),
        flow("e2", "c-apigw", "c-sfn", 2, {
          flowKind: "control",
          label: "start run",
          isCriticalPath: true,
          failureBehavior: "retry",
        }),
        flow("e3", "c-sfn", "c-ddb", 3, { flowKind: "data", label: "state" }),
        flow("e4", "c-sfn", "c-s3", 4, { flowKind: "data", label: "scripts" }),
        flow("e5", "c-sfn", "c-ecs", 5, {
          flowKind: "control",
          label: "spawn workers",
          isCriticalPath: true,
          failureBehavior: "retry",
        }),
        flow("e6", "c-ecs", "c-cw", 6, {
          flowKind: "async",
          label: "metrics",
          isCriticalPath: true,
          failureBehavior: "dlq",
        }),
        flow("e7", "c-cw", "c-lambda", 7, { flowKind: "async", label: "aggregate" }),
        flow("e8", "c-lambda", "c-iot", 8, { flowKind: "async", label: "live telemetry status" }),
      ];
      return { nodes, edges };
    },
  },
];
