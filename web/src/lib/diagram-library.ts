/** P0.1.2 — Biblioteca de vistas tipadas por projeto. */

export type DiagramKind =
  | "context"
  | "application"
  | "data"
  | "runtime"
  | "security"
  | "dr"
  | "sequence";

export const ALL_DIAGRAM_KINDS: DiagramKind[] = [
  "context",
  "application",
  "data",
  "runtime",
  "security",
  "dr",
  "sequence",
];

export const DIAGRAM_KIND_META: Record<
  DiagramKind,
  { label: string; short: string; description: string; defaultName: string }
> = {
  context: {
    label: "Contexto (C4 L1)",
    short: "Context",
    description: "Atores externos e sistemas de fronteira",
    defaultName: "Context Diagram",
  },
  application: {
    label: "Aplicação (C4 L2)",
    short: "App",
    description: "Containers e serviços principais",
    defaultName: "Application Diagram",
  },
  data: {
    label: "Dados",
    short: "Data",
    description: "Stores, pipelines e ownership",
    defaultName: "Data Diagram",
  },
  runtime: {
    label: "Runtime / Infra",
    short: "Runtime",
    description: "Deploy, rede e zonas",
    defaultName: "Runtime Diagram",
  },
  security: {
    label: "Segurança",
    short: "Security",
    description: "IAM, SG, trust boundaries",
    defaultName: "Security Diagram",
  },
  dr: {
    label: "DR / Continuidade",
    short: "DR",
    description: "Região B, failover, RPO/RTO",
    defaultName: "DR Diagram",
  },
  sequence: {
    label: "Sequência",
    short: "Seq",
    description: "Request path temporal",
    defaultName: "Sequence Diagram",
  },
};

export type DiagramLibraryEntry = {
  kind: DiagramKind;
  graphId?: string;
  name: string;
  parentGraphId?: string | null;
  c4ParentNodeId?: string | null;
};

/** Vistas padrão oferecidas ao criar projeto. */
export function defaultDiagramLibrary(projectName: string): DiagramLibraryEntry[] {
  return ALL_DIAGRAM_KINDS.map((kind) => ({
    kind,
    name: `${projectName} — ${DIAGRAM_KIND_META[kind].defaultName}`,
    parentGraphId: kind === "application" ? undefined : null,
    c4ParentNodeId: null,
  }));
}

export function diagramKindLabel(kind: DiagramKind | string | null | undefined): string {
  if (!kind || !(kind in DIAGRAM_KIND_META)) return "Diagrama";
  return DIAGRAM_KIND_META[kind as DiagramKind].label;
}
