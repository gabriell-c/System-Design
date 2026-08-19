import type { ProjectNfr } from "./types";

/** Metadados do title block para export board-ready (P0.2.1). */
export type BoardExportMeta = {
  title: string;
  author?: string;
  version?: string;
  date?: string;
  provider?: string;
  classification?: string;
  nfr?: ProjectNfr | null;
};

export const BOARD_TITLE_BLOCK_HEIGHT = 72;
export const BOARD_LEGEND_WIDTH = 220;
export const BOARD_LEGEND_HEIGHT = 280;
export const BOARD_PADDING = 16;

/** HTML do title block (rodapé esquerdo) para composição em PNG/PDF. */
export function renderTitleBlockHtml(meta: BoardExportMeta): string {
  const author = meta.author ?? "Arquiteto";
  const version = meta.version ?? "1.0";
  const date = meta.date ?? new Date().toLocaleDateString("pt-BR");
  const provider = meta.provider ? `<p style="margin:4px 0 0;color:#64748b">Provider: ${escapeHtml(meta.provider)}</p>` : "";
  const classification = meta.classification
    ? `<span style="padding:2px 6px;border-radius:4px;background:rgba(148,163,184,0.15);color:#94a3b8">${escapeHtml(meta.classification)}</span>`
    : "";

  const nfrBadges: string[] = [];
  if (meta.nfr?.availability_pct != null) {
    nfrBadges.push(
      `<span style="padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3)">${meta.nfr.availability_pct}% SLA</span>`,
    );
  }
  if (meta.nfr?.latency_p99_ms != null) {
    nfrBadges.push(
      `<span style="padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3)">p99 ${meta.nfr.latency_p99_ms}ms</span>`,
    );
  }
  const nfrHtml =
    nfrBadges.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${nfrBadges.join("")}</div>`
      : "";

  return `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;width:100%;font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#94a3b8">
    <div style="min-width:0;flex:1">
      <p style="margin:0;font-size:13px;font-weight:600;color:#f1f5f9">${escapeHtml(meta.title)}</p>
      <p style="margin:4px 0 0">${escapeHtml(author)} · v${escapeHtml(version)} · ${escapeHtml(date)}</p>
      ${provider}
      <p style="margin:6px 0 0">${classification}</p>
    </div>
    ${nfrHtml}
  </div>`;
}

/** HTML da legenda (canto inferior direito) para export board-ready. */
export function renderLegendHtml(): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:10px;color:#94a3b8;width:100%">
    <p style="margin:0 0 8px;font-weight:600;color:#cbd5e1">Legenda</p>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="display:inline-block;width:24px;height:2px;background:#94a3b8;border-radius:1px"></span>
      <span>Sync (HTTP/gRPC)</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="display:inline-block;width:24px;height:0;border-top:2px dashed #a78bfa"></span>
      <span>Async (Kafka/AMQP)</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="display:inline-block;width:24px;height:2px;background:#34d399;border-radius:1px"></span>
      <span>Data flow</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="display:inline-block;width:24px;height:2px;background:#f472b6;border-radius:1px"></span>
      <span>Critical path ★</span>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;margin-bottom:8px">
      <p style="margin:0 0 4px;color:#64748b">Fluxos numerados</p>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-flex;width:18px;height:18px;border-radius:9999px;background:#0ea5e9;color:#fff;font-size:9px;font-weight:700;align-items:center;justify-content:center">1</span>
        <span>Ordem de execução / caminho crítico</span>
      </div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px">
      <p style="margin:0 0 4px;color:#64748b">Zonas</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <span style="padding:2px 4px;border-radius:4px;background:rgba(56,189,248,0.12);color:#38bdf8">Region</span>
        <span style="padding:2px 4px;border-radius:4px;background:rgba(167,139,250,0.12);color:#a78bfa">VPC</span>
        <span style="padding:2px 4px;border-radius:4px;background:rgba(52,211,153,0.12);color:#34d399">AZ</span>
        <span style="padding:2px 4px;border-radius:4px;background:rgba(251,191,36,0.12);color:#fbbf24">Public</span>
      </div>
    </div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dimensões totais do frame board-ready (diagrama + title block + legenda). */
export function boardFrameSize(diagramWidth: number, diagramHeight: number): {
  width: number;
  height: number;
  diagramOffsetY: number;
} {
  const footerHeight = BOARD_TITLE_BLOCK_HEIGHT + BOARD_PADDING;
  return {
    width: diagramWidth + BOARD_LEGEND_WIDTH + BOARD_PADDING * 3,
    height: diagramHeight + footerHeight + BOARD_PADDING,
    diagramOffsetY: BOARD_PADDING,
  };
}
