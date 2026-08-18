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
      firewallRules: opts?.firewallRules,
    },
  });
}

const nfr = (partial: Partial<ProjectNfr>): ProjectNfr => ({
  ...emptyNfr(),
  ...partial,
  environments: {
    ...emptyNfr().environments,
    has_dev: true,
    has_staging: true,
    has_prod: true,
    has_ci_cd: true,
    has_backups: true,
    has_monitoring_plan: true,
  },
});

export const SCALE_TEMPLATES: ProjectTemplate[] = [
  {
    id: "youtube-scale",
    label: "YouTube-scale (8 subsystems)",
    description: "Ingest, encoding, CDN, search, recs, ads, live e identity — composição de plataforma de vídeo.",
    name: "Video platform",
    context:
      "Plataforma de vídeo na escala de centenas de milhões de usuários/dia. Subsystems: ingest de upload, " +
      "encoding multi-bitrate, CDN global, search, recomendações, ads, live e identity. Multi-região, RPO 15min / RTO 30min.",
    nfr: nfr({
      users_per_day: 50_000_000,
      availability_pct: 99.95,
      latency_p99_ms: 200,
      team_size: 80,
      deadline_weeks: 52,
      compliance: ["LGPD", "SOC2"],
      arch_style: "event_driven",
      rpo_hours: 0.25,
      rto_minutes: 30,
      business_processes: ["Upload", "Watch", "Search", "Recommend", "Monetize", "Live"],
      data_entities: ["video", "user", "watch_history", "ad_auction"],
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-id", "security_boundary", { x: 40, y: 40 }, { label: "Identity", provider: "aws" }),
        createZoneNode("z-ingest", "plane", { x: 440, y: 40 }, { label: "Ingest", provider: "aws" }),
        createZoneNode("z-enc", "layer", { x: 880, y: 40 }, { label: "Encoding", provider: "aws" }),
        createZoneNode("z-cdn", "plane", { x: 40, y: 380 }, { label: "CDN global", provider: "aws" }),
        createZoneNode("z-search", "layer", { x: 440, y: 380 }, { label: "Search", provider: "aws" }),
        createZoneNode("z-recs", "layer", { x: 880, y: 380 }, { label: "Recommendations", provider: "aws" }),
        createZoneNode("z-ads", "layer", { x: 40, y: 720 }, { label: "Ads", provider: "aws" }),
        createZoneNode("z-live", "plane", { x: 440, y: 720 }, { label: "Live", provider: "aws" }),
        createZoneNode("z-data", "subnet_private", { x: 880, y: 720 }, { label: "Data plane", provider: "aws" }),
      ];
      const cards = [
        card("c-cog", "id-cognito", { x: 24, y: 48 }, "z-id"),
        card("c-apigw", "cloud-aws-apigw", { x: 24, y: 48 }, "z-ingest"),
        card("c-kafka", "int-kafka", { x: 24, y: 140 }, "z-ingest"),
        card("c-ecs", "cloud-aws-ecs", { x: 24, y: 48 }, "z-enc"),
        card("c-s3enc", "cloud-aws-s3", { x: 24, y: 140 }, "z-enc"),
        card("c-waf", "sec-waf", { x: 24, y: 48 }, "z-cdn"),
        card("c-cf", "cloud-aws-cf", { x: 24, y: 140 }, "z-cdn"),
        card("c-es", "db-elasticsearch", { x: 24, y: 48 }, "z-search"),
        card("c-rec", "be-fastapi", { x: 24, y: 48 }, "z-recs"),
        card("c-redis", "db-redis", { x: 24, y: 140 }, "z-recs"),
        card("c-ads", "be-nest", { x: 24, y: 48 }, "z-ads"),
        card("c-live", "cloud-aws-ecs", { x: 24, y: 48 }, "z-live"),
        card("c-pg", "db-postgres", { x: 24, y: 48 }, "z-data"),
        card("c-s3", "cloud-aws-s3", { x: 24, y: 140 }, "z-data"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-cog", "c-apigw", 1, { label: "auth", isCriticalPath: true }),
        flow("e2", "c-apigw", "c-kafka", 2, { flowKind: "async", protocol: "kafka", label: "upload", isCriticalPath: true }),
        flow("e3", "c-kafka", "c-ecs", 3, { flowKind: "async", protocol: "kafka", label: "encode jobs" }),
        flow("e4", "c-ecs", "c-s3enc", 4, { flowKind: "data", protocol: "s3", label: "renditions" }),
        flow("e5", "c-s3enc", "c-cf", 5, { flowKind: "data", protocol: "s3", label: "origin" }),
        flow("e6", "c-waf", "c-cf", 6, { label: "watch", isCriticalPath: true, failureBehavior: "fail_fast" }),
        flow("e7", "c-apigw", "c-es", 7, { flowKind: "data", label: "index" }),
        flow("e8", "c-kafka", "c-rec", 8, { flowKind: "async", protocol: "kafka", label: "watch events" }),
        flow("e9", "c-rec", "c-redis", 9, { flowKind: "data", label: "feature cache" }),
        flow("e10", "c-cf", "c-ads", 10, { label: "ad stitch" }),
        flow("e11", "c-apigw", "c-live", 11, { label: "live ingest" }),
        flow("e12", "c-apigw", "c-pg", 12, { flowKind: "data", protocol: "sql", label: "metadata" }),
        flow("e13", "c-s3enc", "c-s3", 13, { flowKind: "data", protocol: "s3", label: "archive" }),
      ];
      return { nodes, edges };
    },
  },
  {
    id: "cicd-pipeline",
    label: "CI/CD Pipeline",
    description: "Repo → build → registry → Terraform/K8s → observabilidade. Diagrama de entrega contínua.",
    name: "CI/CD Pipeline",
    context: "Pipeline de entrega: GitHub, Actions, Terraform, Kubernetes, Prometheus/Grafana. Ambientes staging + prod.",
    nfr: nfr({
      users_per_day: 0,
      team_size: 6,
      availability_pct: 99.5,
      arch_style: "layered",
      rpo_hours: 24,
      rto_minutes: 60,
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-src", "plane", { x: 40, y: 80 }, { label: "Source", provider: "generic" }),
        createZoneNode("z-build", "layer", { x: 480, y: 80 }, { label: "Build / Registry", provider: "generic" }),
        createZoneNode("z-deploy", "plane", { x: 920, y: 80 }, { label: "Deploy", provider: "aws" }),
        createZoneNode("z-obs", "layer", { x: 480, y: 420 }, { label: "Observability", provider: "generic" }),
      ];
      const cards = [
        card("c-gh", "int-github", { x: 24, y: 48 }, "z-src"),
        card("c-gha", "dep-ghactions", { x: 24, y: 140 }, "z-src"),
        card("c-test", "obs-sentry", { x: 240, y: 140 }, "z-src"),
        card("c-tf", "dep-terraform", { x: 24, y: 48 }, "z-build"),
        card("c-docker", "dep-docker", { x: 24, y: 140 }, "z-build"),
        card("c-k8s", "dep-k8s", { x: 24, y: 48 }, "z-deploy"),
        card("c-ecs", "cloud-aws-ecs", { x: 24, y: 140 }, "z-deploy"),
        card("c-prom", "obs-prometheus", { x: 24, y: 48 }, "z-obs"),
        card("c-graf", "obs-grafana", { x: 250, y: 48 }, "z-obs"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-gh", "c-gha", 1, { flowKind: "control", label: "push" }),
        flow("e2", "c-gha", "c-docker", 2, { flowKind: "control", label: "build image" }),
        flow("e3", "c-gha", "c-test", 3, { flowKind: "control", label: "run tests" }),
        flow("e4", "c-gha", "c-tf", 4, { flowKind: "control", label: "plan/apply" }),
        flow("e5", "c-tf", "c-k8s", 5, { flowKind: "control", label: "infra" }),
        flow("e6", "c-docker", "c-ecs", 6, { flowKind: "control", label: "rollout" }),
        flow("e7", "c-k8s", "c-ecs", 7, { flowKind: "control", label: "workload" }),
        flow("e8", "c-ecs", "c-prom", 8, { flowKind: "management", label: "metrics" }),
        flow("e9", "c-prom", "c-graf", 9, { flowKind: "management", label: "dashboards" }),
      ];
      return { nodes, edges };
    },
  },
  {
    id: "hybrid-network",
    label: "Rede enterprise (VPN / Peering / DX)",
    description: "VPC + peering + VPN + Direct Connect + PrivateLink. Diagrama de rede completo.",
    name: "Enterprise network",
    context: "Rede híbrida: duas VPCs com peering, VPN para escritório, Direct Connect para datacenter, PrivateLink para SaaS.",
    nfr: nfr({
      availability_pct: 99.9,
      team_size: 12,
      compliance: ["SOC2"],
      rpo_hours: 1,
      rto_minutes: 15,
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-reg", "region", { x: 40, y: 40 }, { label: "us-east-1", provider: "aws" }),
        createZoneNode("z-vpc-a", "vpc", { x: 24, y: 56 }, { label: "VPC A", provider: "aws", parentId: "z-reg" }),
        createZoneNode("z-pub", "subnet_public", { x: 24, y: 48 }, { label: "Public", provider: "aws", parentId: "z-vpc-a" }),
        createZoneNode("z-priv", "subnet_private", { x: 320, y: 48 }, { label: "Private", provider: "aws", parentId: "z-vpc-a" }),
        createZoneNode("z-peer", "peering", { x: 880, y: 80 }, { label: "Peering", provider: "aws" }),
        createZoneNode("z-vpn", "vpn", { x: 880, y: 380 }, { label: "VPN / DX", provider: "aws" }),
        createZoneNode("z-pl", "privatelink", { x: 40, y: 720 }, { label: "PrivateLink", provider: "aws" }),
      ];
      const cards = [
        card("c-alb", "cloud-aws-alb", { x: 16, y: 40 }, "z-pub"),
        card("c-nat", "net-aws-nat", { x: 16, y: 40 }, "z-priv"),
        card("c-ecs", "cloud-aws-ecs", { x: 16, y: 132 }, "z-priv"),
        card("c-pg", "db-postgres", { x: 16, y: 224 }, "z-priv"),
        card("c-peer", "net-aws-peering", { x: 24, y: 48 }, "z-peer"),
        card("c-vpn", "net-aws-vpn", { x: 24, y: 48 }, "z-vpn"),
        card("c-dx", "net-aws-dx", { x: 24, y: 140 }, "z-vpn"),
        card("c-pl", "net-aws-privatelink", { x: 24, y: 48 }, "z-pl"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-alb", "c-ecs", 1, {
          label: "HTTPS :443",
          isCriticalPath: true,
          firewallRules: [{ port: "443", protocol: "tcp", direction: "inbound" }],
        }),
        flow("e2", "c-ecs", "c-pg", 2, {
          flowKind: "data",
          protocol: "sql",
          label: "5432",
          firewallRules: [{ port: "5432", protocol: "tcp", direction: "inbound" }],
        }),
        flow("e3", "c-peer", "c-ecs", 3, { flowKind: "management", label: "peering" }),
        flow("e4", "c-vpn", "c-nat", 4, { flowKind: "management", label: "IPsec" }),
        flow("e5", "c-dx", "c-pg", 5, { flowKind: "data", protocol: "sql", label: "on-prem sync" }),
        flow("e6", "c-ecs", "c-pl", 6, { label: "SaaS privado" }),
      ];
      return { nodes, edges };
    },
  },
];
