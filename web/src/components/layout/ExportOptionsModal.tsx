"use client";

import { useEffect, useId, useState } from "react";
import {
  downloadJson,
  downloadText,
  slugifyFilename,
  toArchitectureMarkdown,
  toExportPayload,
} from "@/lib/export";
import { exportArchitecturePdf, exportArchitecturePng, type CaptureCanvasOptions } from "@/lib/export-canvas";
import { downloadSvg, renderSvg } from "@/lib/export-svg";
import { useGraphStore } from "@/lib/graph-store";

export type ExportFormat = "png" | "svg" | "pdf" | "json" | "md";

export type ExportOptions = {
  format: ExportFormat;
  margin: number;
  width: number;
  height: number;
  pixelRatio: number;
  boardReady: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialFormat?: ExportFormat;
};

const DEFAULTS: ExportOptions = {
  format: "png",
  margin: 0.15,
  width: 1600,
  height: 900,
  pixelRatio: 2,
  boardReady: true,
};

export default function ExportOptionsModal({ open, onClose, initialFormat = "png" }: Props) {
  const titleId = useId();
  const [opts, setOpts] = useState<ExportOptions>({ ...DEFAULTS, format: initialFormat });
  const [busy, setBusy] = useState(false);

  const name = useGraphStore((s) => s.name);
  const context = useGraphStore((s) => s.context);
  const nfr = useGraphStore((s) => s.nfr);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const analysis = useGraphStore((s) => s.analysis);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  useEffect(() => {
    if (open) setOpts((o) => ({ ...o, format: initialFormat }));
  }, [open, initialFormat]);

  if (!open) return null;

  const base = slugifyFilename(name);

  async function run() {
    setBusy(true);
    try {
      const capture: CaptureCanvasOptions = {
        width: opts.width,
        height: opts.height,
        padding: opts.margin,
        pixelRatio: opts.pixelRatio,
        boardReady: opts.boardReady,
        meta: {
          title: name,
          nfr,
          author: "Arquiteto",
          version: "1.0",
        },
      };

      if (opts.format === "png") {
        await exportArchitecturePng(`${base}.png`, nodes, {
          boardReady: opts.boardReady,
          meta: capture.meta,
          width: opts.width,
          height: opts.height,
          padding: opts.margin,
          pixelRatio: opts.pixelRatio,
        });
        pushUiNotice({ type: "success", text: "PNG exportado com as opções escolhidas." });
      } else if (opts.format === "svg") {
        const svg = renderSvg(nodes, edges, { title: name });
        downloadSvg(svg, `${base}.svg`);
        pushUiNotice({ type: "success", text: "SVG exportado." });
      } else if (opts.format === "pdf") {
        await exportArchitecturePdf(name, nodes, edges, {
          context,
          nfr,
          analysis,
          includeDiagram: true,
          meta: capture.meta,
        });
        pushUiNotice({ type: "success", text: "PDF: use “Salvar como PDF” na impressão." });
      } else if (opts.format === "json") {
        downloadJson(
          `${base}.graph.json`,
          await toExportPayload(name, nodes, edges, analysis, context, nfr),
        );
        pushUiNotice({ type: "success", text: "JSON exportado." });
      } else {
        const md = toArchitectureMarkdown(name, nodes, edges, { context, nfr, analysis });
        downloadText(`${base}.architecture-package.md`, md, "text/markdown;charset=utf-8");
        pushUiNotice({ type: "success", text: "Markdown exportado." });
      }
      onClose();
    } catch (err) {
      pushUiNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Falha na exportação.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 elev-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
          Opções de exportação
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ajuste formato, margem, resolução e title block.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Formato</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              value={opts.format}
              onChange={(e) => setOpts({ ...opts, format: e.target.value as ExportFormat })}
            >
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
              <option value="pdf">PDF</option>
              <option value="json">JSON</option>
              <option value="md">Markdown</option>
            </select>
          </label>

          {(opts.format === "png" || opts.format === "pdf") && (
            <>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Margem (padding 0–0.4)</span>
                <input
                  type="number"
                  min={0}
                  max={0.4}
                  step={0.05}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  value={opts.margin}
                  onChange={(e) => setOpts({ ...opts, margin: Number(e.target.value) || 0 })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Largura</span>
                  <input
                    type="number"
                    min={640}
                    max={4096}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    value={opts.width}
                    onChange={(e) => setOpts({ ...opts, width: Number(e.target.value) || 1600 })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Altura</span>
                  <input
                    type="number"
                    min={480}
                    max={4096}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    value={opts.height}
                    onChange={(e) => setOpts({ ...opts, height: Number(e.target.value) || 900 })}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Pixel ratio (1–3)</span>
                <input
                  type="number"
                  min={1}
                  max={3}
                  step={0.5}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  value={opts.pixelRatio}
                  onChange={(e) => setOpts({ ...opts, pixelRatio: Number(e.target.value) || 2 })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={opts.boardReady}
                  onChange={(e) => setOpts({ ...opts, boardReady: e.target.checked })}
                />
                Board-ready (title block + legenda)
              </label>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void run()}
            disabled={busy}
            data-testid="export-options-confirm"
          >
            {busy ? "Exportando…" : "Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}
