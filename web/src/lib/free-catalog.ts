import {
  ArrowRight,
  Check,
  Circle,
  Diamond,
  Hexagon,
  Hourglass,
  Octagon,
  Pen,
  Plus,
  Square,
  Triangle,
  Type,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { FreeNodeKind } from "./types";

export type FreeCatalogItem = {
  id: string;
  kind: FreeNodeKind;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const FREE_CATALOG: FreeCatalogItem[] = [
  {
    id: "free-rectangle",
    kind: "free-rectangle",
    label: "Retângulo",
    icon: Square,
    description: "Bloco genérico",
  },
  {
    id: "free-circle",
    kind: "free-circle",
    label: "Círculo",
    icon: Circle,
    description: "Início / fim",
  },
  {
    id: "free-oval",
    kind: "free-oval",
    label: "Oval",
    icon: Hourglass,
    description: "Processo",
  },
  {
    id: "free-diamond",
    kind: "free-diamond",
    label: "Losango",
    icon: Diamond,
    description: "Decisão",
  },
  {
    id: "free-triangle",
    kind: "free-triangle",
    label: "Triângulo",
    icon: Triangle,
    description: "Direção",
  },
  {
    id: "free-hexagon",
    kind: "free-hexagon",
    label: "Hexágono",
    icon: Hexagon,
    description: "Operação",
  },
  {
    id: "free-octagon",
    kind: "free-octagon",
    label: "Octógono",
    icon: Octagon,
    description: "Stop / condição",
  },
  {
    id: "free-arrow-right",
    kind: "free-arrow-right",
    label: "Seta →",
    icon: ArrowRight,
    description: "Fluxo direto",
  },
  {
    id: "free-arrow-double",
    kind: "free-arrow-double",
    label: "Seta ↔",
    icon: Zap,
    description: "Fluxo双向",
  },
  {
    id: "free-check",
    kind: "free-check",
    label: "Check",
    icon: Check,
    description: "Aprovação",
  },
  {
    id: "free-x",
    kind: "free-x",
    label: "X",
    icon: X,
    description: "Rejeição",
  },
  {
    id: "free-plus",
    kind: "free-plus",
    label: "+",
    icon: Plus,
    description: "Adicionar",
  },
  {
    id: "free-text",
    kind: "free-text",
    label: "Texto",
    icon: Type,
    description: "Anotação livre",
  },
  {
    id: "free-edit",
    kind: "free-edit",
    label: "Editar",
    icon: Pen,
    description: "Anotação editável",
  },
];

export const FREE_NODE_DEFAULT_SIZE: Record<FreeNodeKind, { width: number; height: number }> = {
  "free-rectangle": { width: 160, height: 80 },
  "free-circle": { width: 100, height: 100 },
  "free-oval": { width: 140, height: 80 },
  "free-diamond": { width: 120, height: 120 },
  "free-triangle": { width: 100, height: 100 },
  "free-hexagon": { width: 130, height: 110 },
  "free-octagon": { width: 110, height: 110 },
  "free-arrow-right": { width: 120, height: 56 },
  "free-arrow-double": { width: 140, height: 56 },
  "free-check": { width: 80, height: 80 },
  "free-x": { width: 80, height: 80 },
  "free-plus": { width: 80, height: 80 },
  "free-text": { width: 180, height: 48 },
  "free-edit": { width: 160, height: 48 },
};

export function findFreeCatalog(kind: string): FreeCatalogItem | undefined {
  return FREE_CATALOG.find((item) => item.kind === kind || item.id === kind);
}
