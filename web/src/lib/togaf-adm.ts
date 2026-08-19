/**
 * P3.1.1 — TOGAF ADM (Architecture Development Method) leve.
 *
 * Fases do TOGAF ADM mapeadas para vistas no canvas:
 * - Preliminar: escopo, princípios, governança
 * - A (Visões): stakeholders, requisitos, visão arquitetural
 * - B (Negócio): processos, organograma, capacidades
 * - C (Sistemas): dados + aplicações
 * - D (Tecnologia): infraestrutura, plataformas
 * - E (Oportunidades): roadmap, migração
 * - F (Planejamento): detalhamento, governança
 * - G (Implementação): deploy, monitoramento
 * - H (Gestão de Mudanças): mudanças, conformidade
 * - Requisitos: gestão contínua
 */

export type TogafPhase =
  | "preliminar"
  | "fase_a"
  | "fase_b"
  | "fase_c"
  | "fase_d"
  | "fase_e"
  | "fase_f"
  | "fase_g"
  | "fase_h"
  | "requisitos";

export const TOGAF_PHASES: {
  id: TogafPhase;
  label: string;
  short: string;
  description: string;
  focus: string[];
}[] = [
  {
    id: "preliminar",
    label: "Fase Preliminar",
    short: "Pre",
    description: "Definir escopo, princípios e governança de arquitetura.",
    focus: ["principles", "governance", "scope"],
  },
  {
    id: "fase_a",
    label: "Fase A — Visões de Arquitetura",
    short: "Visões",
    description: "Identificar stakeholders, requisitos e visão arquitetural.",
    focus: ["stakeholders", "requirements", "vision"],
  },
  {
    id: "fase_b",
    label: "Fase B — Arquitetura de Negócio",
    short: "Negócio",
    description: "Modelar processos, organizações e capacidades de negócio.",
    focus: ["processes", "org", "capabilities"],
  },
  {
    id: "fase_c",
    label: "Fase C — Arquitetura de Sistemas",
    short: "Sistemas",
    description: "Definir arquitetura de dados e aplicações.",
    focus: ["data", "applications"],
  },
  {
    id: "fase_d",
    label: "Fase D — Arquitetura de Tecnologia",
    short: "Tecnologia",
    description: "Especificar infraestrutura e plataformas.",
    focus: ["infrastructure", "platforms"],
  },
  {
    id: "fase_e",
    label: "Fase E — Oportunidades e Soluções",
    short: "Oportun.",
    description: "Identificar gaps e definir roadmap de migração.",
    focus: ["gaps", "roadmap", "migration"],
  },
  {
    id: "fase_f",
    label: "Fase F — Planejamento de Migração",
    short: "Planej.",
    description: "Detalhar implementação e governança.",
    focus: ["implementation", "governance"],
  },
  {
    id: "fase_g",
    label: "Fase G — Implementação",
    short: "Impl.",
    description: "Deploy, monitoramento e conformidade.",
    focus: ["deployment", "monitoring", "compliance"],
  },
  {
    id: "fase_h",
    label: "Fase H — Gestão de Mudanças",
    short: "Mudanças",
    description: "Gerenciar mudanças e evolução da arquitetura.",
    focus: ["changes", "evolution"],
  },
  {
    id: "requisitos",
    label: "Requisitos de Arquitetura",
    short: "Req.",
    description: "Gestão contínua de requisitos.",
    focus: ["requirements", "traceability"],
  },
];

/** Mapeia node kind para fases TOGAF que se aplicam */
const NODE_TOGAF_MAP: Record<string, TogafPhase[]> = {
  frontend: ["fase_b", "fase_c", "requisitos"],
  backend: ["fase_b", "fase_c", "fase_d", "requisitos"],
  database: ["fase_c", "fase_d", "requisitos"],
  cloud: ["fase_d", "fase_e", "requisitos"],
  identity: ["fase_a", "fase_b", "fase_c", "requisitos"],
  observability: ["fase_d", "fase_g", "requisitos"],
  integration: ["fase_c", "fase_d", "requisitos"],
  security: ["fase_a", "fase_b", "fase_c", "fase_d", "requisitos"],
  deploy: ["fase_e", "fase_f", "fase_g", "requisitos"],
  zone: ["fase_d", "fase_e", "requisitos"],
};

/** Obtém as fases TOGAF relevantes para um nó */
export function getTogafPhasesForNode(kind: string): TogafPhase[] {
  return NODE_TOGAF_MAP[kind] ?? ["requisitos"];
}

/** Conta nós por fase TOGAF */
export function countNodesByTogafPhase(nodes: Array<{ data: { kind: string } }>): Record<TogafPhase, number> {
  const counts: Record<TogafPhase, number> = {
    preliminar: 0,
    fase_a: 0,
    fase_b: 0,
    fase_c: 0,
    fase_d: 0,
    fase_e: 0,
    fase_f: 0,
    fase_g: 0,
    fase_h: 0,
    requisitos: 0,
  };
  for (const node of nodes) {
    const phases = getTogafPhasesForNode(node.data.kind);
    for (const phase of phases) {
      counts[phase]++;
    }
  }
  return counts;
}

/** Verifica se todas as fases TOGAF têm cobertura mínima */
export function checkTogafCoverage(
  nodes: Array<{ data: { kind: string } }>,
  minNodesPerPhase = 1,
): { covered: TogafPhase[]; gaps: TogafPhase[]; coveragePct: number } {
  const counts = countNodesByTogafPhase(nodes);
  const covered: TogafPhase[] = [];
  const gaps: TogafPhase[] = [];
  for (const phase of Object.keys(counts) as TogafPhase[]) {
    if (counts[phase] >= minNodesPerPhase) {
      covered.push(phase);
    } else {
      gaps.push(phase);
    }
  }
  const coveragePct = covered.length / Object.keys(counts).length;
  return { covered, gaps, coveragePct };
}

/** Gera summary TOGAF para o grafo */
export function togafSummary(nodes: Array<{ data: { kind: string } }>): {
  phases: Array<{ phase: TogafPhase; count: number }>;
  coverage: { covered: TogafPhase[]; gaps: TogafPhase[]; coveragePct: number };
  recommendation: string;
} {
  const counts = countNodesByTogafPhase(nodes);
  const coverage = checkTogafCoverage(nodes);
  const phases = (Object.keys(counts) as TogafPhase[]).map((phase) => ({
    phase,
    count: counts[phase],
  })).sort((a, b) => b.count - a.count);

  let recommendation = "";
  if (coverage.gaps.includes("fase_a")) {
    recommendation += "Defina stakeholders e requisitos na Fase A. ";
  }
  if (coverage.gaps.includes("fase_b")) {
    recommendation += "Modelo de negócio precisa de mais nós. ";
  }
  if (coverage.gaps.includes("fase_c")) {
    recommendation += "Arquitetura de sistemas/subdados incompleta. ";
  }
  if (coverage.gaps.includes("fase_d")) {
    recommendation += "Add infraestrutura/zone nodes. ";
  }
  if (coverage.gaps.includes("fase_e")) {
    recommendation += "Considere roadmap de migração. ";
  }
  if (recommendation === "") {
    recommendation = "Cobertura TOGAF OK para escopo atual.";
  }

  return { phases, coverage, recommendation };
}
