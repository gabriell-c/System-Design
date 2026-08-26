import type { Edge, Node } from "@xyflow/react";
import type {
  AnalysisResult,
  ArchNodeData,
  BlockNodeData,
  CanvasNodeData,
  GraphRecord,
  NodeKind,
  ProjectNfr,
  ZoneNodeData,
} from "./types";

const DOMAIN_LABELS: Record<NodeKind, string> = {
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

function isBlockData(data: CanvasNodeData): data is BlockNodeData {
  return data.kind === "block";
}

function isZoneData(data: CanvasNodeData): data is ZoneNodeData {
  return data.kind === "zone";
}

function isArchData(data: CanvasNodeData): data is ArchNodeData {
  return data.kind !== "block" && data.kind !== "zone";
}

function summarizeNfr(nfr: ProjectNfr): string {
  const parts: string[] = [];
  if (nfr.users_per_day != null) parts.push(`~${nfr.users_per_day}/dia`);
  if (nfr.budget_usd_month != null) parts.push(`US$${nfr.budget_usd_month}/mês`);
  if (nfr.availability_pct != null) parts.push(`${nfr.availability_pct}%`);
  if (nfr.latency_p99_ms != null) parts.push(`p99 ${nfr.latency_p99_ms}ms`);
  if (nfr.compliance.length) parts.push(nfr.compliance.join(", "));
  if (nfr.team_size != null) parts.push(`time ${nfr.team_size}`);
  return parts.join(" · ") || "NFRs ainda não preenchidos";
}

export type GraphExport = {
  format: "system-design-saas.graph";
  version: 1;
  name: string;
  context?: string;
  nfr?: ProjectNfr | null;
  exportedAt: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  analysis?: AnalysisResult | null;
  /** SHA-256 hex of canonical payload (excluding this field). Optional for legacy files. */
  checksum?: string;
};

/** Stable JSON for hashing — sorted keys, no checksum field. */
export function canonicalExportPayload(payload: Omit<GraphExport, "checksum">): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function toExportPayload(
  name: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  analysis?: AnalysisResult | null,
  context?: string,
  nfr?: ProjectNfr | null,
): Promise<GraphExport> {
  const base: Omit<GraphExport, "checksum"> = {
    format: "system-design-saas.graph",
    version: 1,
    name: name.trim() || "Arquitetura sem nome",
    context: context ?? "",
    nfr: nfr ?? null,
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
    analysis: analysis ?? null,
  };
  const checksum = await sha256Hex(canonicalExportPayload(base));
  return { ...base, checksum };
}

export async function parseImportPayload(raw: unknown): Promise<GraphExport> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Arquivo inválido: JSON esperado.");
  }
  const data = raw as Partial<GraphExport>;
  if (data.format !== "system-design-saas.graph") {
    throw new Error("Arquivo não é um export deste editor.");
  }
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error("Export sem nodes/edges.");
  }
  const parsed: GraphExport = {
    format: "system-design-saas.graph",
    version: 1,
    name: typeof data.name === "string" ? data.name : "Importado",
    context: typeof data.context === "string" ? data.context : "",
    nfr: (data.nfr as GraphExport["nfr"]) ?? null,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    nodes: data.nodes as Node<CanvasNodeData>[],
    edges: data.edges as Edge[],
    analysis: data.analysis ?? null,
  };
  if (typeof data.checksum === "string" && data.checksum.length > 0) {
    const expected = await sha256Hex(canonicalExportPayload(parsed));
    if (expected !== data.checksum) {
      throw new Error("Arquivo corrompido: checksum não corresponde.");
    }
    parsed.checksum = data.checksum;
  }
  return parsed;
}

export function slugifyFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "arquitetura"
  );
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, payload: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
}

export function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function recordToExport(graph: GraphRecord): GraphExport {
  return {
    format: "system-design-saas.graph",
    version: 1,
    name: graph.name,
    context: graph.context ?? "",
    nfr: graph.nfr ?? null,
    exportedAt: graph.updated_at,
    nodes: graph.nodes as Node<CanvasNodeData>[],
    edges: graph.edges as Edge[],
    analysis: graph.analysis,
  };
}

function nodeLabel(node: Node<CanvasNodeData>): string {
  return node.data.label?.trim() || node.id;
}

function domainLabel(kind: NodeKind): string {
  return DOMAIN_LABELS[kind] ?? kind;
}

function listByDomain(nodes: Node<CanvasNodeData>[]) {
  const blocks = nodes.filter((n) => isBlockData(n.data));
  const cards = nodes.filter((n) => isArchData(n.data));
  const groups = new Map<NodeKind, { blocks: Node<CanvasNodeData>[]; cards: Node<CanvasNodeData>[] }>();

  for (const block of blocks) {
    if (!isBlockData(block.data)) continue;
    const domain = block.data.domain;
    const entry = groups.get(domain) ?? { blocks: [], cards: [] };
    entry.blocks.push(block);
    groups.set(domain, entry);
  }
  for (const card of cards) {
    if (!isArchData(card.data)) continue;
    const kind = card.data.kind;
    const entry = groups.get(kind) ?? { blocks: [], cards: [] };
    entry.cards.push(card);
    groups.set(kind, entry);
  }
  return groups;
}

function edgeLine(edge: Edge, nodes: Node<CanvasNodeData>[]): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const src = byId.get(edge.source);
  const tgt = byId.get(edge.target);
  const data = (edge.data ?? {}) as { flowNumber?: number; label?: string; flowKind?: string };
  const prefix =
    data.flowNumber != null ? `${data.flowNumber}. ` : data.flowKind ? `[${data.flowKind}] ` : "";
  const suffix = data.label ? ` (${data.label})` : "";
  return `${prefix}${src ? nodeLabel(src) : edge.source} → ${tgt ? nodeLabel(tgt) : edge.target}${suffix}`;
}

export function toArchitectureMarkdown(
  name: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  options?: {
    context?: string;
    nfr?: ProjectNfr | null;
    analysis?: AnalysisResult | null;
    exportedAt?: string;
  },
): string {
  const title = name.trim() || "Arquitetura sem nome";
  const when = options?.exportedAt ?? new Date().toISOString();
  const context = options?.context?.trim() ?? "";
  const nfr = options?.nfr ?? null;
  const analysis = options?.analysis ?? null;
  const groups = listByDomain(nodes);
  const lines: string[] = [`# ${title}`, "", `> Exportado em ${when}`, ""];

  if (context) {
    lines.push("## Contexto", "", context, "");
  }

  if (nfr) {
    lines.push("## NFRs / SLOs", "", `- Resumo: ${summarizeNfr(nfr)}`);
    if (nfr.users_per_day != null) lines.push(`- Usuários/dia: ${nfr.users_per_day}`);
    if (nfr.budget_usd_month != null) lines.push(`- Orçamento (US$/mês): ${nfr.budget_usd_month}`);
    const avail = nfr.slo_availability_pct ?? nfr.availability_pct;
    const lat = nfr.slo_latency_p99_ms ?? nfr.latency_p99_ms;
    if (avail != null) lines.push(`- Disponibilidade (SLO): ${avail}%`);
    if (lat != null) lines.push(`- Latência p99 (SLO): ${lat} ms`);
    if (nfr.team_size != null) lines.push(`- Time: ${nfr.team_size}`);
    if (nfr.deadline_weeks != null) lines.push(`- Prazo: ${nfr.deadline_weeks} semanas`);
    if (nfr.compliance.length) lines.push(`- Compliance: ${nfr.compliance.join(", ")}`);
    if (nfr.arch_style) lines.push(`- Estilo: ${nfr.arch_style}`);
    const env = nfr.environments;
    const envFlags = [
      env.has_dev && "dev",
      env.has_staging && "staging",
      env.has_prod && "prod",
      env.has_ci_cd && "CI/CD",
      env.has_backups && "backups",
      env.has_monitoring_plan && "monitoramento",
    ].filter(Boolean);
    if (envFlags.length) lines.push(`- Ambientes: ${envFlags.join(", ")}`);
    lines.push("");

    lines.push("## Vistas AN / AD / AA / AI", "");
    lines.push("### AN — Negócio");
    if (nfr.business_processes?.length) {
      for (const p of nfr.business_processes) lines.push(`- ${p}`);
    } else {
      lines.push("_Sem processos declarados._");
    }
    lines.push("", "### AD — Dados");
    if (nfr.data_entities?.length) {
      for (const e of nfr.data_entities) lines.push(`- Entidade: ${e}`);
    } else {
      lines.push("_Sem entidades declaradas._");
    }
    if (nfr.data_governance?.length) {
      for (const g of nfr.data_governance) lines.push(`- Governança: ${g}`);
    }
    lines.push(
      "",
      "### AA — Aplicação",
      `- Estilo: ${nfr.arch_style ?? analysis?.arch_style ?? "_não declarado_"}`,
      "",
      "### AI — Runtime",
      "_Ver zonas e componentes abaixo._",
      "",
    );

    if (nfr.critical_path_edge_ids?.length || nfr.failure_modes?.length) {
      lines.push("## Caminho crítico e falhas", "");
      if (nfr.critical_path_edge_ids?.length) {
        lines.push(`- Edges do caminho crítico: ${nfr.critical_path_edge_ids.join(", ")}`);
      }
      for (const e of edges) {
        const d = e.data as { isCriticalPath?: boolean; failureBehavior?: string; label?: string } | undefined;
        if (d?.isCriticalPath) {
          lines.push(`- Crítico: ${edgeLine(e, nodes)}${d.failureBehavior ? ` [${d.failureBehavior}]` : ""}`);
        }
      }
      for (const fm of nfr.failure_modes ?? []) {
        lines.push(
          `- **Falha** em \`${fm.component_id}\`: ${fm.mode} — impacto: ${fm.impact}; mitigação: ${fm.mitigation}`,
        );
      }
      lines.push("");
    }
  }

  lines.push("## Componentes", "");
  if (nodes.length === 0) {
    lines.push("_Nenhum componente no canvas._", "");
  } else {
    const zones = nodes.filter((n) => isZoneData(n.data));
    if (zones.length) {
      lines.push("### Zonas de arquitetura", "");
      for (const z of zones) {
        if (!isZoneData(z.data)) continue;
        lines.push(
          `- **${z.data.zoneKind}:** ${z.data.label}${z.parentId ? ` (pai: ${z.parentId})` : ""}`,
        );
      }
      lines.push("");
    }
    for (const [domain, group] of groups) {
      lines.push(`### ${domainLabel(domain)}`, "");
      for (const block of group.blocks) {
        if (!isBlockData(block.data)) continue;
        lines.push(
          `- **Bloco:** ${block.data.label}${block.data.description ? ` — ${block.data.description}` : ""}`,
        );
      }
      for (const card of group.cards) {
        if (!isArchData(card.data)) continue;
        const bits = [card.data.tech, card.data.catalogId].filter(Boolean);
        lines.push(`- **${card.data.label}**${bits.length ? ` (\`${bits.join(" · ")}\`)` : ""}`);
        if (card.data.notes?.trim()) {
          const plain = card.data.notes
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (plain) lines.push(`  - Notas: ${plain}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("## Conexões", "");
  if (edges.length === 0) {
    lines.push("_Sem ligações._", "");
  } else {
    for (const edge of edges) {
      lines.push(`- ${edgeLine(edge, nodes)}`);
    }
    lines.push("");
  }

  if (analysis) {
    lines.push(
      "## Análise",
      "",
      `- Nota: **${analysis.score.toFixed(1)}**`,
      `- Fonte: ${analysis.ia_ok ? "IA" : "heurística local"}`,
      "",
      analysis.summary,
      "",
    );
    if (analysis.review_scorecard) {
      const sc = analysis.review_scorecard;
      lines.push(
        "### Review scorecard",
        "",
        `- Geral: **${sc.overall.toFixed(1)}/10** ${sc.review_ready ? "(review-ready)" : ""}`,
        `- Narrativa: ${sc.narrative.toFixed(1)}`,
        `- Vistas: ${sc.views_completeness.toFixed(1)}`,
        `- Placement: ${sc.placement.toFixed(1)}`,
        `- Fluxos: ${sc.flow_continuity.toFixed(1)}`,
        `- Operabilidade: ${sc.operability.toFixed(1)}`,
        `- Decisão: ${sc.decision_quality.toFixed(1)}`,
        "",
      );
      if (sc.gaps?.length) {
        lines.push("Gaps:", "");
        for (const g of sc.gaps) lines.push(`- ${g}`);
        lines.push("");
      }
    }
    if (analysis.trade_offs?.length) {
      lines.push("### Trade-offs", "");
      for (const t of analysis.trade_offs) {
        lines.push(`- **${t.decisao}** vs ${t.alternativa_rejeitada}: + ${t.vantagem}; − ${t.desvantagem}`);
      }
      lines.push("");
    }
    if (analysis.strengths.length) {
      lines.push("### Pontos fortes", "");
      for (const s of analysis.strengths) lines.push(`- ${s}`);
      lines.push("");
    }
    if (analysis.risks.length) {
      lines.push("### Riscos", "");
      for (const r of analysis.risks) lines.push(`- ${r}`);
      lines.push("");
    }
    if (analysis.suggestions.length) {
      lines.push("### Sugestões", "");
      for (const s of analysis.suggestions) lines.push(`- ${s}`);
      lines.push("");
    }
    if (analysis.findings.length) {
      lines.push("### Achados", "");
      for (const f of analysis.findings) {
        lines.push(`- **[${f.severity}] ${f.title}** — ${f.detail}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "## Como testar",
    "",
    "- Rodar Análise no Archia e conferir scorecard ≥ 8.0",
    "- Usar presets de Simulação (load / journey / stress) no caminho crítico",
    "- Validar failureBehavior (retry/DLQ/fallback) com testes de resiliência",
    "",
  );

  lines.push("---", "", "_Architecture Package · Archia / system-design-saas._", "");
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toArchitecturePrintHtml(
  name: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  options?: {
    context?: string;
    nfr?: ProjectNfr | null;
    analysis?: AnalysisResult | null;
    diagramDataUrl?: string | null;
  },
): string {
  const md = toArchitectureMarkdown(name, nodes, edges, options);
  const body = md
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("> ")) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
      if (line.startsWith("- ")) {
        const inner = escapeHtml(line.slice(2))
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`(.+?)`/g, "<code>$1</code>");
        return `<li>${inner}</li>`;
      }
      if (line === "---") return "<hr />";
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
    })
    .join("\n")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);

  const diagram = options?.diagramDataUrl
    ? `<figure class="diagram"><img src="${options.diagramDataUrl}" alt="Diagrama da arquitetura" /></figure>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(name.trim() || "Arquitetura")}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 32px; line-height: 1.45; }
    h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
    h3 { font-size: 1.05rem; margin: 1rem 0 0.35rem; }
    blockquote { color: #64748b; margin: 0 0 1rem; padding-left: 0.75rem; border-left: 3px solid #cbd5e1; }
    ul { padding-left: 1.25rem; }
    li { margin: 0.2rem 0; }
    code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.9em; }
    .diagram { margin: 1rem 0 1.5rem; }
    .diagram img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; }
    @media print {
      body { margin: 12mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="no-print" style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:8px;">
    Use <strong>Salvar como PDF</strong> / <strong>Microsoft Print to PDF</strong> na janela de impressão.
  </p>
  ${diagram}
  ${body}
  <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
</body>
</html>`;
}
