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
      c4Level: undefined,
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
    label: "YouTube-scale (8 subsystems editáveis)",
    description: "8 subsystems profundos: ingest, encoding, CDN, search, recs, ads, live, identity. Cada subsistema é editável.",
    name: "Video platform",
    context:
      "Plataforma de vídeo na escala de centenas de milhões de usuários/dia. " +
      "8 subsystems editáveis: ingest de upload, encoding multi-bitrate com filas, " +
      "CDN global, search, recomendações, ads auction, live streaming e identity. " +
      "Multi-região, RPO 15min / RTO 30min.",
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
      const nodes: Node<CanvasNodeData>[] = [];
      const edges: Edge[] = [];

      // ── 1. IDENTITY (sistema autônomo) ──
      const zId = createZoneNode("z-identity", "security_boundary", { x: 40, y: 40 }, { label: "Identity", provider: "aws" });
      nodes.push(zId);
      const cIdP = card("c-oidc", "sec-oidc", { x: 24, y: 48 }, "z-identity");
      const cIdS = card("c-secrets", "sec-secrets", { x: 24, y: 160 }, "z-identity");
      const cIdK = card("c-kms-key", "sec-kms-key", { x: 160, y: 48 }, "z-identity");
      if (cIdP) nodes.push(cIdP);
      if (cIdS) nodes.push(cIdS);
      if (cIdK) nodes.push(cIdK);
      edges.push(flow("e-id1", "c-oidc", "c-secrets", 1, { flowKind: "async", label: "token exchange" }));
      edges.push(flow("e-id2", "c-secrets", "c-kms-key", 2, { flowKind: "control", label: "key ref" }));

      // ── 2. INGEST (upload → kafka → S3) ──
      const zIngest = createZoneNode("z-ingest", "plane", { x: 480, y: 40 }, { label: "Ingest", provider: "aws" });
      nodes.push(zIngest);
      const cIngApi = card("c-ingest-api", "be-fastapi", { x: 24, y: 48 }, "z-ingest");
      const cIngKafka = card("c-ingest-kafka", "int-kafka", { x: 24, y: 140 }, "z-ingest");
      const cIngS3 = card("c-ingest-s3", "cloud-aws-s3", { x: 160, y: 48 }, "z-ingest");
      if (cIngApi) nodes.push(cIngApi);
      if (cIngKafka) nodes.push(cIngKafka);
      if (cIngS3) nodes.push(cIngS3);
      edges.push(flow("e-ing1", "c-ingest-api", "c-ingest-s3", 3, { flowKind: "data", protocol: "s3", label: "original upload", isCriticalPath: true }));
      edges.push(flow("e-ing2", "c-ingest-api", "c-ingest-kafka", 4, { flowKind: "async", protocol: "kafka", label: "upload event" }));

      // ── 3. ENCODING (multi-bitrate com filas + DRM) ──
      const zEnc = createZoneNode("z-enc", "layer", { x: 880, y: 40 }, { label: "Encoding", provider: "aws" });
      nodes.push(zEnc);
      const cEncKafka = card("c-enc-kafka", "int-kafka", { x: 24, y: 48 }, "z-enc");
      const cEncEcs = card("c-enc-ecs", "cloud-aws-ecs", { x: 160, y: 48 }, "z-enc");
      const cEncS3 = card("c-enc-s3", "cloud-aws-s3", { x: 160, y: 160 }, "z-enc");
      const cEncDrm = card("c-enc-drm", "sec-secrets", { x: 280, y: 48 }, "z-enc");
      if (cEncKafka) nodes.push(cEncKafka);
      if (cEncEcs) nodes.push(cEncEcs);
      if (cEncS3) nodes.push(cEncS3);
      if (cEncDrm) nodes.push(cEncDrm);
      edges.push(flow("e-enc1", "c-ingest-kafka", "c-enc-kafka", 5, { flowKind: "async", protocol: "kafka", label: "encoding jobs" }));
      edges.push(flow("e-enc2", "c-enc-kafka", "c-enc-ecs", 6, { flowKind: "async", label: "trigger" }));
      edges.push(flow("e-enc3", "c-enc-ecs", "c-enc-s3", 7, { flowKind: "data", protocol: "s3", label: "renditions" }));
      edges.push(flow("e-enc4", "c-enc-ecs", "c-enc-drm", 8, { flowKind: "control", label: "DRM license" }));

      // ── 4. CDN GLOBAL ──
      const zCdn = createZoneNode("z-cdn", "plane", { x: 40, y: 380 }, { label: "CDN Global", provider: "aws" });
      nodes.push(zCdn);
      const cCdnWaf = card("c-cdn-waf", "mc-aws-waf", { x: 24, y: 48 }, "z-cdn");
      const cCdnCf = card("c-cdn-cf", "cloud-aws-cf", { x: 160, y: 48 }, "z-cdn");
      const cCdnOrigin = card("c-cdn-origin", "cloud-aws-s3", { x: 280, y: 48 }, "z-cdn");
      if (cCdnWaf) nodes.push(cCdnWaf);
      if (cCdnCf) nodes.push(cCdnCf);
      if (cCdnOrigin) nodes.push(cCdnOrigin);
      edges.push(flow("e-cdn1", "c-cdn-waf", "c-cdn-cf", 9, { label: "HTTPS", isCriticalPath: true }));
      edges.push(flow("e-cdn2", "c-cdn-cf", "c-cdn-origin", 10, { flowKind: "data", protocol: "s3", label: "pull origin" }));
      edges.push(flow("e-cdn3", "c-enc-s3", "c-cdn-origin", 11, { flowKind: "data", protocol: "s3", label: "renditions" }));

      // ── 5. SEARCH ──
      const zSearch = createZoneNode("z-search", "layer", { x: 480, y: 380 }, { label: "Search", provider: "aws" });
      nodes.push(zSearch);
      const cSearchE = card("c-search-es", "db-elasticsearch", { x: 24, y: 48 }, "z-search");
      const cSearchPg = card("c-search-pg", "db-postgres", { x: 160, y: 48 }, "z-search");
      if (cSearchE) nodes.push(cSearchE);
      if (cSearchPg) nodes.push(cSearchPg);
      edges.push(flow("e-s1", "c-ingest-api", "c-search-es", 12, { flowKind: "data", label: "index metadata" }));
      edges.push(flow("e-s2", "c-search-es", "c-search-pg", 13, { flowKind: "data", protocol: "sql", label: "primary" }));

      // ── 6. RECOMMENDATIONS ──
      const zRecs = createZoneNode("z-recs", "layer", { x: 880, y: 380 }, { label: "Recommendations", provider: "aws" });
      nodes.push(zRecs);
      const cRec = card("c-rec", "be-fastapi", { x: 24, y: 48 }, "z-recs");
      const cRecRedis = card("c-rec-redis", "db-redis", { x: 160, y: 48 }, "z-recs");
      const cRecKafka = card("c-rec-kafka", "int-kafka", { x: 24, y: 160 }, "z-recs");
      if (cRec) nodes.push(cRec);
      if (cRecRedis) nodes.push(cRecRedis);
      if (cRecKafka) nodes.push(cRecKafka);
      edges.push(flow("e-r1", "c-ingest-kafka", "c-rec-kafka", 14, { flowKind: "async", protocol: "kafka", label: "watch events" }));
      edges.push(flow("e-r2", "c-rec-kafka", "c-rec", 15, { flowKind: "async", label: "process" }));
      edges.push(flow("e-r3", "c-rec", "c-rec-redis", 16, { flowKind: "data", label: "feature cache" }));

      // ── 7. ADS ──
      const zAds = createZoneNode("z-ads", "layer", { x: 40, y: 720 }, { label: "Ads", provider: "aws" });
      nodes.push(zAds);
      const cAds = card("c-ads", "be-nest", { x: 24, y: 48 }, "z-ads");
      const cAdsRedis = card("c-ads-redis", "db-redis", { x: 160, y: 48 }, "z-ads");
      const cAdsKafka = card("c-ads-kafka", "int-kafka", { x: 24, y: 160 }, "z-ads");
      if (cAds) nodes.push(cAds);
      if (cAdsRedis) nodes.push(cAdsRedis);
      if (cAdsKafka) nodes.push(cAdsKafka);
      edges.push(flow("e-a1", "c-cdn-cf", "c-ads", 17, { label: "ad stitch", isCriticalPath: true }));
      edges.push(flow("e-a2", "c-rec", "c-ads", 18, { flowKind: "data", label: "user features" }));
      edges.push(flow("e-a3", "c-ads", "c-ads-redis", 19, { flowKind: "data", label: "bid cache" }));

      // ── 8. LIVE ──
      const zLive = createZoneNode("z-live", "plane", { x: 480, y: 720 }, { label: "Live", provider: "aws" });
      nodes.push(zLive);
      const cLiveApi = card("c-live-api", "be-fastapi", { x: 24, y: 48 }, "z-live");
      const cLiveMedia = card("c-live-media", "cloud-aws-media", { x: 160, y: 48 }, "z-live");
      const cLiveS3 = card("c-live-s3", "cloud-aws-s3", { x: 280, y: 48 }, "z-live");
      if (cLiveApi) nodes.push(cLiveApi);
      if (cLiveMedia) nodes.push(cLiveMedia);
      if (cLiveS3) nodes.push(cLiveS3);
      edges.push(flow("e-l1", "c-ingest-api", "c-live-api", 20, { label: "live ingest", isCriticalPath: true }));
      edges.push(flow("e-l2", "c-live-api", "c-live-media", 21, { flowKind: "data", label: "RTMP ingest" }));
      edges.push(flow("e-l3", "c-live-media", "c-live-s3", 22, { flowKind: "data", protocol: "s3", label: "archive" }));

      // ── DATA PLANE (core shared) ──
      const zData = createZoneNode("z-data", "subnet_private", { x: 880, y: 720 }, { label: "Data plane", provider: "aws" });
      nodes.push(zData);
      const cDataPg = card("c-data-pg", "db-postgres", { x: 24, y: 48 }, "z-data");
      const cDataS3 = card("c-data-s3", "cloud-aws-s3", { x: 160, y: 48 }, "z-data");
      const cDataRedshift = card("c-data-redshift", "db-redshift", { x: 24, y: 160 }, "z-data");
      if (cDataPg) nodes.push(cDataPg);
      if (cDataS3) nodes.push(cDataS3);
      if (cDataRedshift) nodes.push(cDataRedshift);
      edges.push(flow("e-d1", "c-search-pg", "c-data-pg", 23, { flowKind: "data", protocol: "sql", label: "CDC" }));
      edges.push(flow("e-d2", "c-data-pg", "c-data-redshift", 24, { flowKind: "data", protocol: "sql", label: "ETL" }));
      edges.push(flow("e-d3", "c-data-redshift", "c-data-s3", 25, { flowKind: "data", protocol: "s3", label: "export" }));

      // ── CROSS-CUTTING (shared infra) ──
      const cSg = card("c-sg", "sec-sg", { x: 440, y: 720 }, undefined);
      const cKms = card("c-kms", "sec-kms-key", { x: 600, y: 720 }, undefined);
      if (cSg) nodes.push(cSg);
      if (cKms) nodes.push(cKms);

      return { nodes, edges };
    },
  },
  {
    id: "cicd-pipeline",
    label: "CI/CD Pipeline (双流版)",
    description: "研发流+用户流双通道CI/CD架构，含代码仓库、构建、测试、部署、监控完整链路。",
    name: "CI/CD Pipeline Dual-Flow",
    context: "双通道CI/CD架构：研发侧涵盖代码提交→自动化测试→镜像构建→K8s部署，用户侧涵盖CDN分发→API网关→微服务→数据库，含生产环境隔离与安全审计。",
    nfr: nfr({
      users_per_day: 500000,
      team_size: 15,
      availability_pct: 99.95,
      arch_style: "microservices",
      rpo_hours: 1,
      rto_minutes: 15,
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        // 研发流区域
        createZoneNode("z-src", "plane", { x: 40, y: 80 }, { label: "代码仓库", provider: "github" }),
        createZoneNode("z-ci", "layer", { x: 480, y: 80 }, { label: "CI构建", provider: "github" }),
        createZoneNode("z-test", "plane", { x: 920, y: 80 }, { label: "自动化测试", provider: "generic" }),
        createZoneNode("z-deploy", "plane", { x: 480, y: 260 }, { label: "K8s部署", provider: "aws" }),
        // 用户流区域
        createZoneNode("z-cdn", "plane", { x: 40, y: 420 }, { label: "CDN分发", provider: "aws" }),
        createZoneNode("z-api", "layer", { x: 480, y: 420 }, { label: "API网关", provider: "aws" }),
        createZoneNode("z-service", "plane", { x: 920, y: 420 }, { label: "微服务", provider: "aws" }),
        createZoneNode("z-data", "plane", { x: 480, y: 580 }, { label: "数据存储", provider: "aws" }),
        createZoneNode("z-obs", "layer", { x: 920, y: 580 }, { label: "监控告警", provider: "generic" }),
      ];
      const cards = [
        // 研发流节点
        card("c-git", "int-github", { x: 24, y: 48 }, "z-src"),
        card("c-actions", "dep-ghactions", { x: 24, y: 140 }, "z-src"),
        card("c-jenkins", "dep-jenkins", { x: 240, y: 48 }, "z-ci"),
        card("c-docker", "dep-docker", { x: 24, y: 48 }, "z-ci"),
        card("c-jest", "obs-jest", { x: 24, y: 48 }, "z-test"),
        card("c-k8s", "dep-k8s", { x: 24, y: 48 }, "z-deploy"),
        card("c-argocd", "dep-argocd", { x: 160, y: 48 }, "z-deploy"),
        // 用户流节点
        card("c-cloudfront", "cloud-aws-cf", { x: 24, y: 48 }, "z-cdn"),
        card("c-apigw", "cloud-aws-apigw", { x: 24, y: 48 }, "z-api"),
        card("c-ecs", "cloud-aws-ecs", { x: 24, y: 48 }, "z-service"),
        card("c-lambda", "cloud-aws-lambda", { x: 160, y: 48 }, "z-service"),
        card("c-rds", "db-postgres", { x: 24, y: 48 }, "z-data"),
        card("c-redis", "db-redis", { x: 160, y: 48 }, "z-data"),
        card("c-prom", "obs-prometheus", { x: 24, y: 48 }, "z-obs"),
        card("c-graf", "obs-grafana", { x: 160, y: 48 }, "z-obs"),
        card("c-alert", "obs-alertmanager", { x: 240, y: 48 }, "z-obs"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        // 研发流
        flow("e1", "c-git", "c-actions", 1, { flowKind: "control", label: "push/PR" }),
        flow("e2", "c-actions", "c-jenkins", 2, { flowKind: "control", label: "trigger" }),
        flow("e3", "c-jenkins", "c-docker", 3, { flowKind: "control", label: "build image" }),
        flow("e4", "c-docker", "c-jest", 4, { flowKind: "control", label: "run tests" }),
        flow("e5", "c-jest", "c-k8s", 5, { flowKind: "control", label: "deploy" }),
        flow("e6", "c-k8s", "c-argocd", 6, { flowKind: "control", label: "sync" }),
        // 用户流
        flow("e7", "c-cloudfront", "c-apigw", 7, { flowKind: "sync", label: "HTTPS", isCriticalPath: true }),
        flow("e8", "c-apigw", "c-ecs", 8, { flowKind: "sync", label: "REST" }),
        flow("e9", "c-apigw", "c-lambda", 9, { flowKind: "async", label: "event" }),
        flow("e10", "c-ecs", "c-rds", 10, { flowKind: "data", protocol: "sql", label: "5432" }),
        flow("e11", "c-ecs", "c-redis", 11, { flowKind: "data", protocol: "redis", label: "cache" }),
        // 监控流
        flow("e12", "c-ecs", "c-prom", 12, { flowKind: "management", label: "metrics" }),
        flow("e13", "c-prom", "c-graf", 13, { flowKind: "management", label: "dashboard" }),
        flow("e14", "c-prom", "c-alert", 14, { flowKind: "management", label: "alert" }),
        // 跨流关联
        flow("e15", "c-argocd", "c-ecs", 15, { flowKind: "control", label: "rollout" }),
        flow("e16", "c-alert", "c-git", 16, { flowKind: "management", label: "notify" }),
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
  // P2.3.1 — rede enterprise completa
  {
    id: "enterprise-network",
    label: "Rede enterprise completa (TGW + NACL + Dual-Stack)",
    description: "TGW, NACL, prefix lists, dual-stack, multi-VPC peering — diagrama de rede enterprise.",
    name: "Enterprise network complete",
    context:
      "Rede enterprise completa: região com múltiplas VPCs, Transit Gateway como hub, " +
      "NAT gateways, prefix lists para reference em SGs, dual-stack IPv4/IPv6, " +
      "VPN híbrida e Direct Connect.",
    nfr: nfr({
      availability_pct: 99.99,
      team_size: 8,
      compliance: ["SOC2", "ISO27001"],
      rpo_hours: 0.5,
      rto_minutes: 10,
      arch_style: "network",
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        createZoneNode("z-reg", "region", { x: 40, y: 40 }, { label: "us-east-1", provider: "aws" }),
        createZoneNode("z-vpc-a", "vpc", { x: 24, y: 56 }, { label: "VPC A (App)", provider: "aws", parentId: "z-reg" }),
        createZoneNode("z-vpc-b", "vpc", { x: 520, y: 56 }, { label: "VPC B (Data)", provider: "aws", parentId: "z-reg" }),
        createZoneNode("z-az-a", "availability_zone", { x: 24, y: 48 }, { label: "AZ-a", provider: "aws", parentId: "z-vpc-a" }),
        createZoneNode("z-az-b", "availability_zone", { x: 220, y: 48 }, { label: "AZ-b", provider: "aws", parentId: "z-vpc-a" }),
        createZoneNode("z-pub-a", "subnet_public", { x: 24, y: 48 }, { label: "Public-a", provider: "aws", parentId: "z-az-a" }),
        createZoneNode("z-priv-a", "subnet_private", { x: 200, y: 48 }, { label: "Private-a", provider: "aws", parentId: "z-az-a" }),
        createZoneNode("z-tgw", "tgw", { x: 880, y: 80 }, { label: "Transit Gateway", provider: "aws" }),
        createZoneNode("z-nat", "nat_gateway", { x: 24, y: 400 }, { label: "NAT Gateway", provider: "aws" }),
        createZoneNode("z-prefix", "prefix_list", { x: 260, y: 400 }, { label: "Prefix Lists", provider: "aws" }),
        createZoneNode("z-dual", "vpn", { x: 520, y: 400 }, { label: "Dual-Stack IPv4/IPv6", provider: "aws" }),
      ];
      const cards = [
        // VPC A
        card("c-alb-a", "cloud-aws-alb", { x: 16, y: 40 }, "z-pub-a"),
        card("c-ecs-a", "cloud-aws-ecs", { x: 16, y: 128 }, "z-priv-a"),
        card("c-pg-a", "db-postgres", { x: 16, y: 216 }, "z-priv-a"),
        card("c-sg-a", "sec-sg", { x: 160, y: 40 }, "z-priv-a"),
        card("c-nacl-a", "net-nacl", { x: 160, y: 128 }, "z-priv-a"),
        // VPC B
        card("c-ecs-b", "cloud-aws-ecs", { x: 16, y: 40 }, "z-priv-b" as any),
        card("c-redshift", "db-redshift", { x: 16, y: 128 }, "z-priv-b" as any),
        card("c-sg-b", "sec-sg", { x: 160, y: 40 }, "z-priv-b" as any),
        // Shared
        card("c-waf", "mc-aws-waf", { x: 24, y: 48 }, undefined),
        card("c-tgw-attach-a", "net-tgw", { x: 24, y: 48 }, "z-tgw"),
        card("c-tgw-attach-b", "net-tgw", { x: 160, y: 48 }, "z-tgw"),
        card("c-nat-gw", "net-aws-nat", { x: 24, y: 48 }, "z-nat"),
        card("c-prefix-video", "net-prefix", { x: 24, y: 48 }, "z-prefix"),
        card("c-prefix-api", "net-prefix", { x: 160, y: 48 }, "z-prefix"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        flow("e1", "c-waf", "c-alb-a", 1, { label: "HTTPS", isCriticalPath: true, firewallRules: [{ port: "443", protocol: "tcp", direction: "inbound" }] }),
        flow("e2", "c-alb-a", "c-ecs-a", 2, { label: "app traffic", firewallRules: [{ port: "8080", protocol: "tcp", direction: "inbound" }] }),
        flow("e3", "c-ecs-a", "c-pg-a", 3, { flowKind: "data", protocol: "sql", label: "5432" }),
        flow("e4", "c-ecs-a", "c-nacl-a", 4, { flowKind: "control", label: "NACL eval" }),
        flow("e5", "c-ecs-a", "c-nat-gw", 5, { flowKind: "data", label: "egress" }),
        flow("e6", "c-tgw-attach-a", "z-tgw", 6, { flowKind: "data", label: "VPC attachment" }),
        flow("e7", "c-tgw-attach-b", "z-tgw", 7, { flowKind: "data", label: "VPC attachment" }),
        flow("e8", "z-tgw", "z-nat", 8, { flowKind: "control", label: "transit" }),
        flow("e9", "z-prefix", "c-sg-a", 9, { flowKind: "control", label: "SG reference" }),
        flow("e10", "z-dual", "z-reg", 10, { flowKind: "management", label: "dual-stack" }),
      ];
      return { nodes, edges };
    },
  },
  // P2.3.3 — DR com região B e path de failover
  {
    id: "disaster-recovery",
    label: "DR — Active-Active com failover",
    description: "Duas regiões ativas, replicação síncrona, path de failover documentado.",
    name: "Disaster Recovery",
    context:
      "Arquitetura DR active-active: região primária (us-east-1) e secundária (us-west-2), " +
      "replicação síncrona de banco, DNS failover com health checks, RPO 0, RTO 5min.",
    nfr: nfr({
      availability_pct: 99.999,
      team_size: 12,
      compliance: ["SOC2", "ISO27001"],
      rpo_hours: 0,
      rto_minutes: 5,
      arch_style: "active_active",
    }),
    build: () => {
      const nodes: Node<CanvasNodeData>[] = [
        // Região primária
        createZoneNode("z-reg-a", "region", { x: 40, y: 40 }, { label: "us-east-1 (Primary)", provider: "aws" }),
        createZoneNode("z-vpc-a", "vpc", { x: 24, y: 56 }, { label: "VPC A", provider: "aws", parentId: "z-reg-a" }),
        createZoneNode("z-az-a1", "availability_zone", { x: 24, y: 48 }, { label: "AZ-a1", provider: "aws", parentId: "z-vpc-a" }),
        createZoneNode("z-az-a2", "availability_zone", { x: 200, y: 48 }, { label: "AZ-a2", provider: "aws", parentId: "z-vpc-a" }),
        // Região secundária (DR)
        createZoneNode("z-reg-b", "dr_region", { x: 40, y: 400 }, { label: "us-west-2 (DR)", provider: "aws" }),
        createZoneNode("z-vpc-b", "vpc", { x: 24, y: 56 }, { label: "VPC B", provider: "aws", parentId: "z-reg-b" }),
        createZoneNode("z-az-b1", "availability_zone", { x: 24, y: 48 }, { label: "AZ-b1", provider: "aws", parentId: "z-vpc-b" }),
        // Path de failover
        createZoneNode("z-dns", "security_boundary", { x: 440, y: 220 }, { label: "Route 53 / DNS", provider: "aws" }),
        createZoneNode("z-health", "observability", { x: 680, y: 220 }, { label: "Health Checks", provider: "aws" }),
      ];
      const cards = [
        // Primary
        card("c-alb-a", "cloud-aws-alb", { x: 16, y: 40 }, "z-az-a1"),
        card("c-ecs-a", "cloud-aws-ecs", { x: 16, y: 128 }, "z-az-a1"),
        card("c-pg-a", "db-postgres", { x: 16, y: 216 }, "z-az-a2"),
        card("c-replica-a", "db-postgres", { x: 160, y: 216 }, "z-az-a2"),
        // DR
        card("c-alb-b", "cloud-aws-alb", { x: 16, y: 40 }, "z-az-b1"),
        card("c-ecs-b", "cloud-aws-ecs", { x: 16, y: 128 }, "z-az-b1"),
        card("c-pg-b", "db-postgres", { x: 16, y: 216 }, "z-az-b1"),
        // Failover path
        card("c-route53", "cloud-aws-route53", { x: 24, y: 48 }, "z-dns"),
        card("c-healthcheck", "obs-cloudwatch", { x: 24, y: 48 }, "z-health"),
      ].filter(Boolean) as Node<CanvasNodeData>[];
      nodes.push(...cards);
      const edges = [
        // Primary flows
        flow("e1", "c-alb-a", "c-ecs-a", 1, { label: "HTTPS", isCriticalPath: true }),
        flow("e2", "c-ecs-a", "c-pg-a", 2, { flowKind: "data", protocol: "sql", label: "5432" }),
        flow("e3", "c-pg-a", "c-replica-a", 3, { flowKind: "data", protocol: "sql", label: "replicação" }),
        // Cross-region replication
        flow("e4", "c-pg-a", "c-pg-b", 4, { flowKind: "data", protocol: "sql", label: "replicação síncrona", isCriticalPath: true }),
        flow("e5", "c-ecs-a", "c-ecs-b", 5, { flowKind: "data", label: "sync state" }),
        // Failover path
        flow("e6", "c-route53", "c-alb-a", 6, { label: "PRIMARY", isCriticalPath: true }),
        flow("e7", "c-route53", "c-alb-b", 7, { label: "FALLOVER" }),
        flow("e8", "c-healthcheck", "c-route53", 8, { flowKind: "management", label: "health monitor" }),
        flow("e9", "c-healthcheck", "c-alb-a", 9, { flowKind: "management", label: "ALB probe" }),
        flow("e10", "c-healthcheck", "c-alb-b", 10, { flowKind: "management", label: "ALB probe DR" }),
      ];
      return { nodes, edges };
    },
  },
];
