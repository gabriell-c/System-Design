import type { Node } from "@xyflow/react";
import type { CanvasNodeData, CloudProvider, NodeKind, ZoneKind } from "./types";

export type LayerView = "all" | "storage" | "auth" | "media" | "search" | "network" | "cicd";

export const LAYER_VIEWS: { id: LayerView; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "storage", label: "Storage" },
  { id: "auth", label: "Auth" },
  { id: "media", label: "Media" },
  { id: "search", label: "Search" },
  { id: "network", label: "Rede" },
  { id: "cicd", label: "CI/CD" },
];

export type CanvasFilter = {
  query: string;
  kind: NodeKind | "all";
  zoneKind: ZoneKind | "all";
  provider: CloudProvider | "all";
  layerView: LayerView;
  ownerTeam: string;
};

export const EMPTY_CANVAS_FILTER: CanvasFilter = {
  query: "",
  kind: "all",
  zoneKind: "all",
  provider: "all",
  layerView: "all",
  ownerTeam: "",
};

export function isFilterActive(filter: CanvasFilter): boolean {
  return (
    filter.query.trim().length > 0 ||
    filter.kind !== "all" ||
    filter.zoneKind !== "all" ||
    filter.provider !== "all" ||
    filter.layerView !== "all" ||
    filter.ownerTeam.trim().length > 0
  );
}

function blob(data: CanvasNodeData): string {
  if (data.kind === "zone") {
    return `${data.label} ${data.zoneKind} ${data.provider ?? ""} ${data.description ?? ""}`.toLowerCase();
  }
  if (data.kind === "block") {
    return `${data.label} ${data.domain} ${data.description ?? ""}`.toLowerCase();
  }
  const cfg = data.config || {};
  return `${data.label} ${data.tech} ${data.kind} ${data.catalogId} ${cfg.provider ?? ""} ${cfg.service ?? ""} ${cfg.capability ?? ""}`.toLowerCase();
}

const LAYER_KEYS: Record<Exclude<LayerView, "all">, string[]> = {
  storage: ["database", "postgres", "mysql", "redis", "s3", "blob", "dynamo", "rds", "elasticache", "gcs"],
  auth: ["identity", "cognito", "auth0", "jwt", "oidc", "authorizer", "keycloak", "iam", "waf", "security"],
  media: ["cloudfront", "cdn", "media", "ingest", "encoding", "transcode", "video", "live", "s3"],
  search: ["elastic", "opensearch", "search", "solr", "algolia", "meilisearch"],
  network: ["vpc", "vpn", "peering", "privatelink", "express", "alb", "nlb", "nat", "tgw", "direct connect"],
  cicd: ["deploy", "github actions", "gitlab", "terraform", "pulumi", "ecr", "registry", "coolify"],
};

function matchesLayer(data: CanvasNodeData, view: LayerView): boolean {
  if (view === "all") return true;
  const text = blob(data);
  const keys = LAYER_KEYS[view];
  if (data.kind !== "zone" && data.kind !== "block" && view === "storage" && data.kind === "database") return true;
  if (data.kind !== "zone" && data.kind !== "block" && view === "auth" && (data.kind === "identity" || data.kind === "security"))
    return true;
  if (data.kind !== "zone" && data.kind !== "block" && view === "cicd" && data.kind === "deploy") return true;
  if (data.kind === "zone" && view === "network") {
    return ["vpc", "peering", "vpn", "privatelink", "express_route", "subnet_public", "subnet_private"].includes(
      data.zoneKind,
    );
  }
  if (data.kind === "zone" && view === "auth" && data.zoneKind === "security_boundary") return true;
  return keys.some((k) => text.includes(k));
}

export function nodeMatchesFilter(data: CanvasNodeData, filter: CanvasFilter, ownerTeam?: string | null): boolean {
  if (filter.ownerTeam.trim() && (ownerTeam || "") !== filter.ownerTeam.trim()) {
    return false;
  }
  if (filter.kind !== "all") {
    if (data.kind === "zone") return false;
    if (data.kind === "block" && data.domain !== filter.kind) return false;
    if (data.kind !== "block" && data.kind !== filter.kind) return false;
  }
  if (filter.zoneKind !== "all") {
    if (data.kind !== "zone" || data.zoneKind !== filter.zoneKind) return false;
  }
  if (filter.provider !== "all") {
    const provider = data.kind === "zone" ? data.provider : data.kind === "block" ? undefined : data.config?.provider;
    if (provider !== filter.provider) return false;
  }
  if (!matchesLayer(data, filter.layerView)) return false;
  const q = filter.query.trim().toLowerCase();
  if (q && !blob(data).includes(q)) return false;
  return true;
}

export function filterOpacity(
  node: Node<CanvasNodeData>,
  filter: CanvasFilter,
  ownerTeam?: string | null,
): number {
  if (!isFilterActive(filter)) return 1;
  return nodeMatchesFilter(node.data, filter, ownerTeam) ? 1 : 0.16;
}

export function descendantIds(nodes: Node<CanvasNodeData>[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        added = true;
      }
    }
  }
  return ids;
}
