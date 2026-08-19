import type { Node } from "@xyflow/react";
import type { CanvasNodeData, CloudProvider, ZoneKind, ZoneNodeData } from "./types";

export const ZONE_DEFAULT_SIZE: Record<ZoneKind, { width: number; height: number }> = {
  region: { width: 920, height: 640 },
  vpc: { width: 780, height: 520 },
  availability_zone: { width: 340, height: 420 },
  subnet_public: { width: 280, height: 180 },
  subnet_private: { width: 280, height: 220 },
  layer: { width: 520, height: 280 },
  plane: { width: 420, height: 320 },
  security_boundary: { width: 360, height: 260 },
  peering: { width: 360, height: 220 },
  vpn: { width: 360, height: 240 },
  privatelink: { width: 360, height: 220 },
  express_route: { width: 360, height: 220 },
  data_mesh: { width: 480, height: 320 },
  tgw: { width: 380, height: 200 },
  nat_gateway: { width: 260, height: 140 },
  prefix_list: { width: 220, height: 100 },
  dr_region: { width: 920, height: 640 },
};

export const ZONE_META: Record<
  ZoneKind,
  { label: string; accent: string; bg: string; border: string; short: string }
> = {
  region: {
    label: "Region",
    short: "Region",
    accent: "#38bdf8",
    bg: "rgba(14, 165, 233, 0.08)",
    border: "rgba(56, 189, 248, 0.45)",
  },
  vpc: {
    label: "VPC / VNet",
    short: "VPC",
    accent: "#a78bfa",
    bg: "rgba(139, 92, 246, 0.08)",
    border: "rgba(167, 139, 250, 0.5)",
  },
  availability_zone: {
    label: "Availability Zone",
    short: "AZ",
    accent: "#34d399",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(52, 211, 153, 0.45)",
  },
  subnet_public: {
    label: "Subnet pública",
    short: "Public",
    accent: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(251, 191, 36, 0.45)",
  },
  subnet_private: {
    label: "Subnet privada",
    short: "Private",
    accent: "#fb923c",
    bg: "rgba(249, 115, 22, 0.08)",
    border: "rgba(251, 146, 60, 0.45)",
  },
  layer: {
    label: "Layer",
    short: "Layer",
    accent: "#818cf8",
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(129, 140, 248, 0.45)",
  },
  plane: {
    label: "Plane",
    short: "Plane",
    accent: "#2dd4bf",
    bg: "rgba(20, 184, 166, 0.08)",
    border: "rgba(45, 212, 191, 0.45)",
  },
  security_boundary: {
    label: "Security boundary",
    short: "Security",
    accent: "#f472b6",
    bg: "rgba(236, 72, 153, 0.08)",
    border: "rgba(244, 114, 182, 0.5)",
  },
  peering: {
    label: "VPC / VNet Peering",
    short: "Peering",
    accent: "#67e8f9",
    bg: "rgba(6, 182, 212, 0.08)",
    border: "rgba(103, 232, 249, 0.45)",
  },
  vpn: {
    label: "VPN / Hybrid",
    short: "VPN",
    accent: "#c4b5fd",
    bg: "rgba(139, 92, 246, 0.1)",
    border: "rgba(196, 181, 253, 0.5)",
  },
  privatelink: {
    label: "PrivateLink / Private Endpoint",
    short: "PrivateLink",
    accent: "#86efac",
    bg: "rgba(22, 163, 74, 0.08)",
    border: "rgba(134, 239, 172, 0.45)",
  },
  express_route: {
    label: "ExpressRoute / Direct Connect",
    short: "DX / ER",
    accent: "#fdba74",
    bg: "rgba(234, 88, 12, 0.1)",
    border: "rgba(253, 186, 116, 0.5)",
  },
  data_mesh: {
    label: "Data Mesh Zone",
    short: "Data Mesh",
    accent: "#c084fc",
    bg: "rgba(168, 85, 247, 0.1)",
    border: "rgba(192, 132, 252, 0.55)",
  },
  tgw: {
    label: "Transit Gateway",
    short: "TGW",
    accent: "#60a5fa",
    bg: "rgba(37, 99, 235, 0.08)",
    border: "rgba(96, 165, 250, 0.5)",
  },
  nat_gateway: {
    label: "NAT Gateway",
    short: "NAT",
    accent: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(251, 191, 36, 0.5)",
  },
  prefix_list: {
    label: "Prefix List",
    short: "Prefix",
    accent: "#94a3b8",
    bg: "rgba(100, 116, 139, 0.08)",
    border: "rgba(148, 163, 184, 0.45)",
  },
  dr_region: {
    label: "Disaster Recovery Region",
    short: "DR",
    accent: "#f472b6",
    bg: "rgba(236, 72, 153, 0.08)",
    border: "rgba(244, 114, 182, 0.5)",
  },
};

/** Filhos zoneKind permitidos dentro de um pai. */
const ZONE_CHILD_ALLOWED: Record<ZoneKind, ZoneKind[]> = {
  region: ["vpc", "plane", "layer", "security_boundary", "peering", "vpn", "privatelink", "express_route", "data_mesh", "tgw", "nat_gateway", "prefix_list", "dr_region"],
  vpc: ["availability_zone", "subnet_public", "subnet_private", "plane", "layer", "security_boundary", "peering", "vpn", "privatelink", "data_mesh", "tgw", "nat_gateway", "prefix_list"],
  availability_zone: ["subnet_public", "subnet_private", "layer", "plane"],
  subnet_public: ["layer", "plane"],
  subnet_private: ["layer", "plane", "security_boundary", "privatelink"],
  layer: ["plane", "security_boundary"],
  plane: ["layer", "security_boundary"],
  security_boundary: ["layer"],
  peering: ["layer"],
  vpn: ["layer", "security_boundary"],
  privatelink: ["layer", "security_boundary"],
  express_route: ["layer", "vpn"],
  data_mesh: ["layer", "plane", "security_boundary"],
};

export function isZoneNode(node: Node<CanvasNodeData>): boolean {
  return node.type === "zone" || node.data.kind === "zone";
}

export function isContainerNode(node: Node<CanvasNodeData>): boolean {
  return node.type === "block" || node.type === "zone" || node.data.kind === "block" || node.data.kind === "zone";
}

export function zoneKindOf(node: Node<CanvasNodeData>): ZoneKind | null {
  if (!isZoneNode(node)) return null;
  if (node.data.kind === "zone") return node.data.zoneKind;
  return null;
}

export function zoneDefaults(zoneKind: ZoneKind, provider?: CloudProvider): { label: string; description: string } {
  const meta = ZONE_META[zoneKind];
  const providerHint = provider && provider !== "generic" ? ` (${provider.toUpperCase()})` : "";
  return {
    label: `${meta.label}${providerHint}`,
    description: `Zona de arquitetura · ${meta.short}`,
  };
}

export function createZoneNode(
  id: string,
  zoneKind: ZoneKind,
  position: { x: number; y: number },
  opts?: { label?: string; provider?: CloudProvider; parentId?: string; boundedContext?: string },
): Node<ZoneNodeData> {
  const size = ZONE_DEFAULT_SIZE[zoneKind];
  const defaults = zoneDefaults(zoneKind, opts?.provider);
  return {
    id,
    type: "zone",
    position,
    width: size.width,
    height: size.height,
    style: { ...size },
    parentId: opts?.parentId,
    extent: opts?.parentId ? "parent" : undefined,
    expandParent: opts?.parentId ? true : undefined,
    data: {
      kind: "zone",
      zoneKind,
      label: opts?.label ?? defaults.label,
      provider: opts?.provider ?? "generic",
      description: defaults.description,
      boundedContext: opts?.boundedContext,
      score: null,
    },
  };
}

export function canNestZoneInZone(child: ZoneKind, parent: ZoneKind): boolean {
  return ZONE_CHILD_ALLOWED[parent]?.includes(child) ?? false;
}

/** Cards de serviço podem entrar em qualquer zona (arquitetura real). */
export function canNestCardInZone(_zoneKind: ZoneKind): boolean {
  return true;
}

export function zoneSize(zone: Node<CanvasNodeData>): { width: number; height: number } {
  const zk = zoneKindOf(zone);
  const fallback = zk ? ZONE_DEFAULT_SIZE[zk] : { width: 420, height: 280 };
  const width = Number(zone.width ?? (zone.style as { width?: number } | undefined)?.width ?? fallback.width);
  const height = Number(zone.height ?? (zone.style as { height?: number } | undefined)?.height ?? fallback.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : fallback.width,
    height: Number.isFinite(height) && height > 0 ? height : fallback.height,
  };
}

/** Expande zona pai para caber o filho relativo (mínimo). */
export function ensureZoneFitsChild(
  zone: Node<CanvasNodeData>,
  childRel: { x: number; y: number },
  childSize: { width: number; height: number },
): Node<CanvasNodeData> {
  const { width, height } = zoneSize(zone);
  const needW = Math.max(width, childRel.x + childSize.width + 32);
  const needH = Math.max(height, childRel.y + childSize.height + 32);
  if (needW === width && needH === height) return zone;
  return {
    ...zone,
    width: needW,
    height: needH,
    style: { ...(zone.style ?? {}), width: needW, height: needH },
  };
}

/** Valida hierarquia de zonas e retorna erros se houver problemas. */
export interface ZoneValidationIssue {
  nodeId: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateZoneHierarchy(
  nodes: Node<CanvasNodeData>[],
): ZoneValidationIssue[] {
  const issues: ZoneValidationIssue[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const node of nodes) {
    const data = node.data;
    
    // Check zone nesting validity
    if (data.kind === "zone") {
      const parent = node.parentId ? nodeMap.get(node.parentId) : null;
      if (parent && parent.data.kind === "zone") {
        const childKind = data.zoneKind;
        const parentKind = parent.data.zoneKind as ZoneKind;
        if (!canNestZoneInZone(childKind, parentKind)) {
          issues.push({
            nodeId: node.id,
            message: `Zona "${data.label}" (${childKind}) não pode ficar dentro de "${parent.data.label}" (${parentKind})`,
            severity: 'error',
          });
        }
      }
    }

    // Check if database is in public subnet
    const isArchNode = data.kind !== "block" && data.kind !== "zone";
    if (isArchNode && data.kind === "database") {
      let parentZone = node.parentId ? nodeMap.get(node.parentId) : null;
      while (parentZone) {
        const pd = parentZone.data as CanvasNodeData;
        const zoneData = pd.kind === "zone" ? pd : null;
        if (zoneData && zoneData.zoneKind === "subnet_public") {
          issues.push({
            nodeId: node.id,
            message: `Database "${data.label}" não deve ficar em subnet pública`,
            severity: 'error',
          });
          break;
        }
        if (zoneData && zoneData.zoneKind === "vpc") break;
        parentZone = parentZone.parentId ? nodeMap.get(parentZone.parentId) : null;
      }
    }
  }

  return issues;
}
