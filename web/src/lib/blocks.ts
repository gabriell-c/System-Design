import type { Node } from "@xyflow/react";
import type { BlockNodeData, CanvasNodeData, NodeKind } from "./types";
import { isArchData } from "./types";
import { canNestZoneInZone, isZoneNode, zoneKindOf, zoneSize } from "./zones";
import { isSwimlaneNode, swimlaneKindOf, swimlaneSize } from "./swimlanes";

export const BLOCK_DEFAULT_SIZE = { width: 420, height: 280 };
export const CARD_SIZE = { width: 220, height: 78 };

export function blockSize(block: Node<CanvasNodeData>): { width: number; height: number } {
  if (isZoneNode(block)) return zoneSize(block);
  if (isSwimlaneNode(block)) return swimlaneSize(block);
  const width = Number(
    block.width ?? (block.style as { width?: number } | undefined)?.width ?? BLOCK_DEFAULT_SIZE.width,
  );
  const height = Number(
    block.height ?? (block.style as { height?: number } | undefined)?.height ?? BLOCK_DEFAULT_SIZE.height,
  );
  return {
    width: Number.isFinite(width) && width > 0 ? width : BLOCK_DEFAULT_SIZE.width,
    height: Number.isFinite(height) && height > 0 ? height : BLOCK_DEFAULT_SIZE.height,
  };
}

export function isBlockNode(node: Node<CanvasNodeData>): boolean {
  return node.type === "block" || node.data.kind === "block";
}

/** Bloco de stack, zona de arquitetura ou swimlane. */
export function isContainerNode(node: Node<CanvasNodeData>): boolean {
  return isBlockNode(node) || isZoneNode(node) || isSwimlaneNode(node);
}

export function blockDefaults(domain: NodeKind): { label: string; description: string } {
  const map: Record<NodeKind, { label: string; description: string }> = {
    frontend: { label: "Bloco Frontend", description: "UI, frameworks e estado do cliente" },
    backend: { label: "Bloco Backend", description: "APIs, serviços e regras de negócio" },
    database: { label: "Bloco Dados", description: "Bancos, cache e storage" },
    cloud: { label: "Bloco Infra", description: "Compute, data, edge e plataforma" },
    identity: { label: "Bloco Identidade", description: "Authn/z e IdP" },
    observability: { label: "Bloco Observabilidade", description: "Logs, métricas, tracing e erros" },
    integration: { label: "Bloco Integrações", description: "Filas, pagamentos, e-mail, WhatsApp e webhooks" },
    deploy: { label: "Bloco Deploy", description: "CI/CD, containers, hosting e IaC" },
    security: { label: "Bloco Security", description: "WAF, SGs, KMS, mTLS e certificados" },
    network: { label: "Bloco Network", description: "VPC, TGW, NAT, peering e rotas" },
  };
  return map[domain];
}

export function createBlockNode(
  id: string,
  domain: NodeKind,
  position: { x: number; y: number },
  label?: string,
): Node<BlockNodeData> {
  const defaults = blockDefaults(domain);
  return {
    id,
    type: "block",
    position,
    width: BLOCK_DEFAULT_SIZE.width,
    height: BLOCK_DEFAULT_SIZE.height,
    style: { ...BLOCK_DEFAULT_SIZE },
    data: {
      kind: "block",
      domain,
      label: label ?? defaults.label,
      description: defaults.description,
      score: null,
    },
  };
}

export function absolutePosition(node: Node<CanvasNodeData>, nodes: Node<CanvasNodeData>[]) {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function findBlockAtPoint(
  nodes: Node<CanvasNodeData>[],
  point: { x: number; y: number },
  ignoreId?: string,
): Node<CanvasNodeData> | null {
  return findContainerAtPoint(nodes, point, ignoreId);
}

/** Encontra o contêiner mais interno (zona ou bloco) sob o ponto. */
export function findContainerAtPoint(
  nodes: Node<CanvasNodeData>[],
  point: { x: number; y: number },
  ignoreId?: string,
): Node<CanvasNodeData> | null {
  const containers = nodes.filter((n) => isContainerNode(n) && n.id !== ignoreId);
  let best: Node<CanvasNodeData> | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const container of containers) {
    const abs = absolutePosition(container, nodes);
    const { width, height } = blockSize(container);
    if (point.x >= abs.x && point.x <= abs.x + width && point.y >= abs.y && point.y <= abs.y + height) {
      const area = width * height;
      if (area < bestArea) {
        best = container;
        bestArea = area;
      }
    }
  }
  return best;
}

export function nestInsideBlock(
  node: Node<CanvasNodeData>,
  block: Node<CanvasNodeData>,
  nodes: Node<CanvasNodeData>[],
): Node<CanvasNodeData> {
  const abs = absolutePosition(node, nodes);
  const blockAbs = absolutePosition(block, nodes);
  const { width, height } = blockSize(block);
  const relX = abs.x - blockAbs.x;
  const relY = abs.y - blockAbs.y;
  const inside = relX >= 0 && relY >= 0 && relX <= width - 40 && relY <= height - 40;
  const siblings = nodes.filter((n) => n.parentId === block.id && n.id !== node.id).length;
  const slotX = 24 + (siblings % 2) * 200;
  const slotY = 56 + Math.floor(siblings / 2) * 90;

  return {
    ...node,
    parentId: block.id,
    extent: "parent",
    expandParent: true,
    position: {
      x: inside ? Math.max(16, Math.min(Math.max(16, width - 200), relX)) : slotX,
      y: inside ? Math.max(48, Math.min(Math.max(48, height - 80), relY)) : slotY,
    },
  };
}

export function detachFromParent(node: Node<CanvasNodeData>, nodes: Node<CanvasNodeData>[]): Node<CanvasNodeData> {
  if (!node.parentId) return node;
  const abs = absolutePosition(node, nodes);
  return {
    ...node,
    position: abs,
    parentId: undefined,
    extent: undefined,
    expandParent: undefined,
  };
}

const DOMAIN_LABEL: Record<NodeKind, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Dados",
  cloud: "Infra",
  identity: "Identidade",
  observability: "Observabilidade",
  integration: "Integrações",
  deploy: "Deploy",
  security: "Security",
  network: "Network",
};

/** Card só pode entrar em bloco de stack do mesmo domínio. Zonas aceitam qualquer card. */
export function canNestCardInBlock(cardKind: NodeKind, blockDomain: NodeKind): boolean {
  return cardKind === blockDomain;
}

export function canNestIntoContainer(
  child: Node<CanvasNodeData>,
  parent: Node<CanvasNodeData>,
  nodes?: Node<CanvasNodeData>[],
): boolean {
  if (parent.id === child.id) return false;
  if (nodes) {
    let walk: string | undefined = parent.parentId;
    const seen = new Set<string>();
    while (walk && !seen.has(walk)) {
      if (walk === child.id) return false;
      seen.add(walk);
      walk = nodes.find((n) => n.id === walk)?.parentId;
    }
  }
  if (isZoneNode(parent)) {
    if (isZoneNode(child)) {
      const parentZk = zoneKindOf(parent);
      const childZk = zoneKindOf(child);
      if (!parentZk || !childZk) return false;
      return canNestZoneInZone(childZk, parentZk);
    }
    return true;
  }
  if (isBlockNode(parent)) {
    if (isZoneNode(child) || isBlockNode(child) || isSwimlaneNode(child)) return false;
    const domain = blockDomainOf(parent);
    if (!domain || !isArchData(child.data)) return false;
    return canNestCardInBlock(child.data.kind, domain);
  }
  if (isSwimlaneNode(parent)) {
    if (isZoneNode(child) || isBlockNode(child) || isSwimlaneNode(child)) return false;
    if (!isArchData(child.data)) return false;
    const lane = swimlaneKindOf(parent);
    if (!lane || lane === "dev_flow" || lane === "user_flow") return true;
    if (lane === "frontend") return child.data.kind === "frontend";
    if (lane === "backend") return child.data.kind === "backend" || child.data.kind === "integration";
    if (lane === "database") return child.data.kind === "database" || child.data.kind === "cloud";
    return true;
  }
  return false;
}

export function nestDeniedMessage(
  cardLabel: string,
  cardKind: NodeKind,
  blockLabel: string,
  blockDomain: NodeKind,
): string {
  return `${cardLabel} é ${DOMAIN_LABEL[cardKind]} e não pode entrar em “${blockLabel}” (${DOMAIN_LABEL[blockDomain]}). Use um bloco ${DOMAIN_LABEL[cardKind]}.`;
}

export function blockDomainOf(node: Node<CanvasNodeData>): NodeKind | null {
  if (!isBlockNode(node)) return null;
  if (node.data.kind === "block") return node.data.domain;
  return null;
}
