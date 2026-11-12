import type { CostBreakdown } from "./types";

/**
 * R8 — lógica pura do painel de Custos (JSX-free, testável sob
 * `node --test`; mesmo padrão de select-nav.ts). Teste: cost-view.test.ts.
 */

/**
 * Formata valor em USD pt-BR (moeda com 2 casas; node 20 full-icu é padrão).
 * Ex.: 55 → "US$ 55,00" (o separador símbolo/valor é U+00A0, travado em teste).
 */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
}

/**
 * Percentual de `part` sobre `total` em 0..100 com 1 casa decimal.
 * `total === 0` → 0 (sem NaN/Infinity).
 */
export function pctShare(part: number, total: number): number {
  if (total === 0) return 0;
  const pct = (part / total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Math.max(0, Math.min(100, rounded));
}

/** CSV pt-BR (Excel): separador `;`, BOM UTF-8, aspas duplas para citar campos. */
const CSV_SEPARATOR = ";";
const CSV_BOM = "﻿";
const CSV_HEADER = "nó;serviço;catalog;região;preço_chave;usd_mês;precificado";

function escapeCsvField(value: string): string {
  // `;`, aspas ou quebra de linha → campo citado; aspas internas dobradas.
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Gera o CSV do breakdown: BOM + header + 1 linha por item + linha de total.
 * Rulings (travados em cost-view.test.ts):
 * - números invariáveis (`String(n)`, ponto decimal) — evita ambiguidade de
 *   locale em Excel pt-BR e mantém round-trip exato;
 * - linha de total: `total` na coluna 1, `total_usd_month` na coluna 6
 *   (usd_mês), demais colunas vazias.
 */
export function buildCostCsv(bd: CostBreakdown): string {
  const lines: string[] = [CSV_HEADER];
  for (const item of bd.line_items) {
    lines.push(
      [
        item.node_id,
        item.label,
        item.catalog_id,
        item.region,
        item.cost_key,
        String(item.cost_usd_month),
        String(item.priced),
      ]
        .map(escapeCsvField)
        .join(CSV_SEPARATOR),
    );
  }
  lines.push(["total", "", "", "", "", String(bd.total_usd_month), ""].join(CSV_SEPARATOR));
  return CSV_BOM + lines.join("\n");
}

/** Mensagem de 429 (rate limit) com a janela do header Retry-After. */
export function rateLimitMessage(retryAfter: number): string {
  return `Limite de requisições atingido — tente novamente em ~${retryAfter}s.`;
}

/**
 * Baixa `csv` (com BOM) como arquivo `filename` via Blob + <a download>.
 * Guard SSR: em Node/desenvolvimento sem `document`, retorna silencioso
 * (não há DOM para o clique sintético — documentado + testado).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // O clique já iniciou o download; revogar libera a memória do Blob.
  URL.revokeObjectURL(url);
}
