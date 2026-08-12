import type { Edge, Node } from "@xyflow/react";
import type { AnalysisResult, CanvasNodeData, GraphRecord, NodeKind, ProjectNfr } from "./types";

const DOMAIN_LABELS: Record<NodeKind, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Dados",
  cloud: "Infra",
  identity: "Identidade",
  observability: "Observabilidade",
  integration: "Integrações",
  deploy: "Deploy",
};

function isBlock(data: CanvasNodeData): boolean {
  return data.kind === "block";
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
};

export function toExportPayload(
  name: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  analysis?: AnalysisResult | null,
  context?: string,
  nfr?: ProjectNfr | null,
): GraphExport {
  return {
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
}

export function parseImportPayload(raw: unknown): GraphExport {
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
  return {
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
  const blocks = nodes.filter((n) => isBlock(n.data));
  const cards = nodes.filter((n) => !isBlock(n.data));
  const groups = new Map<NodeKind, { blocks: Node<CanvasNodeData>[]; cards: Node<CanvasNodeData>[] }>();

  for (const block of blocks) {
    if (!isBlock(block.data)) continue;
    const domain = block.data.domain;
    const entry = groups.get(domain) ?? { blocks: [], cards: [] };
    entry.blocks.push(block);
    groups.set(domain, entry);
  }
  for (const card of cards) {
    if (isBlock(card.data)) continue;
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
  return `${src ? nodeLabel(src) : edge.source} → ${tgt ? nodeLabel(tgt) : edge.target}`;
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
    lines.push("## NFRs", "", `- Resumo: ${summarizeNfr(nfr)}`);
    if (nfr.users_per_day != null) lines.push(`- Usuários/dia: ${nfr.users_per_day}`);
    if (nfr.budget_usd_month != null) lines.push(`- Orçamento (US$/mês): ${nfr.budget_usd_month}`);
    if (nfr.availability_pct != null) lines.push(`- Disponibilidade: ${nfr.availability_pct}%`);
    if (nfr.latency_p99_ms != null) lines.push(`- Latência p99: ${nfr.latency_p99_ms} ms`);
    if (nfr.team_size != null) lines.push(`- Time: ${nfr.team_size}`);
    if (nfr.deadline_weeks != null) lines.push(`- Prazo: ${nfr.deadline_weeks} semanas`);
    if (nfr.compliance.length) lines.push(`- Compliance: ${nfr.compliance.join(", ")}`);
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
  }

  lines.push("## Componentes", "");
  if (nodes.length === 0) {
    lines.push("_Nenhum componente no canvas._", "");
  } else {
    for (const [domain, group] of groups) {
      lines.push(`### ${domainLabel(domain)}`, "");
      for (const block of group.blocks) {
        if (!isBlock(block.data)) continue;
        lines.push(
          `- **Bloco:** ${block.data.label}${block.data.description ? ` — ${block.data.description}` : ""}`,
        );
      }
      for (const card of group.cards) {
        if (isBlock(card.data)) continue;
        const bits = [card.data.tech, card.data.catalogId].filter(Boolean);
        lines.push(`- **${card.data.label}**${bits.length ? ` (\`${bits.join(" · ")}\`)` : ""}`);
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

  lines.push("---", "", "_Gerado pelo editor Archia / system-design-saas._", "");
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
