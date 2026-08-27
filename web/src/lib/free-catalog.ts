import {
  ArrowRight,
  ArrowLeftRight,
  Check,
  Circle,
  Diamond,
  Hexagon,
  Hourglass,
  Image,
  Link2,
  Music,
  Octagon,
  Pen,
  Plus,
  Square,
  StickyNote,
  Triangle,
  Type,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import type { FreeNodeKind } from "./types";

export type FreeCatalogItem = {
  id: string;
  kind: FreeNodeKind;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Default Lucide icon id embedded in the node (see free-icons). */
  defaultIcon?: string;
};

export const FREE_CATALOG: FreeCatalogItem[] = [
  {
    id: "free-rectangle",
    kind: "free-rectangle",
    label: "Retângulo",
    icon: Square,
    description: "Bloco genérico",
    defaultIcon: "box",
  },
  {
    id: "free-circle",
    kind: "free-circle",
    label: "Círculo",
    icon: Circle,
    description: "Início / fim",
    defaultIcon: "activity",
  },
  {
    id: "free-oval",
    kind: "free-oval",
    label: "Oval",
    icon: Hourglass,
    description: "Processo",
    defaultIcon: "layers",
  },
  {
    id: "free-diamond",
    kind: "free-diamond",
    label: "Losango",
    icon: Diamond,
    description: "Decisão",
    defaultIcon: "zap",
  },
  {
    id: "free-triangle",
    kind: "free-triangle",
    label: "Triângulo",
    icon: Triangle,
    description: "Direção",
    defaultIcon: "map",
  },
  {
    id: "free-hexagon",
    kind: "free-hexagon",
    label: "Hexágono",
    icon: Hexagon,
    description: "Operação",
    defaultIcon: "cpu",
  },
  {
    id: "free-octagon",
    kind: "free-octagon",
    label: "Octógono",
    icon: Octagon,
    description: "Stop / condição",
    defaultIcon: "shield",
  },
  {
    id: "free-arrow-right",
    kind: "free-arrow-right",
    label: "Seta →",
    icon: ArrowRight,
    description: "Fluxo direto",
    defaultIcon: "truck",
  },
  {
    id: "free-arrow-double",
    kind: "free-arrow-double",
    label: "Seta dupla",
    icon: ArrowLeftRight,
    description: "Fluxo bidirecional",
    defaultIcon: "wifi",
  },
  {
    id: "free-check",
    kind: "free-check",
    label: "Check",
    icon: Check,
    description: "Aprovação",
    defaultIcon: "star",
  },
  {
    id: "free-x",
    kind: "free-x",
    label: "X",
    icon: X,
    description: "Rejeição",
    defaultIcon: "bell",
  },
  {
    id: "free-plus",
    kind: "free-plus",
    label: "+",
    icon: Plus,
    description: "Adicionar",
    defaultIcon: "package",
  },
  {
    id: "free-text",
    kind: "free-text",
    label: "Texto",
    icon: Type,
    description: "Anotação livre",
    defaultIcon: "file",
  },
  {
    id: "free-edit",
    kind: "free-edit",
    label: "Editar",
    icon: Pen,
    description: "Anotação editável",
    defaultIcon: "code",
  },
  {
    id: "free-image",
    kind: "free-image",
    label: "Imagem",
    icon: Image,
    description: "URL ou upload de imagem",
    defaultIcon: "folder",
  },
  {
    id: "free-video",
    kind: "free-video",
    label: "Vídeo",
    icon: Video,
    description: "Embed de vídeo",
    defaultIcon: "smartphone",
  },
  {
    id: "free-audio",
    kind: "free-audio",
    label: "Áudio",
    icon: Music,
    description: "Player de áudio",
    defaultIcon: "activity",
  },
  {
    id: "free-note",
    kind: "free-note",
    label: "Nota",
    icon: StickyNote,
    description: "Post-it com anotações",
    defaultIcon: "file",
  },
  {
    id: "free-link",
    kind: "free-link",
    label: "Link",
    icon: Link2,
    description: "Atalho para URL",
    defaultIcon: "globe",
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
  "free-image": { width: 200, height: 150 },
  "free-video": { width: 280, height: 160 },
  "free-audio": { width: 240, height: 64 },
  "free-note": { width: 180, height: 120 },
  "free-link": { width: 180, height: 56 },
};

export function findFreeCatalog(kind: string): FreeCatalogItem | undefined {
  return FREE_CATALOG.find((item) => item.kind === kind || item.id === kind);
}
