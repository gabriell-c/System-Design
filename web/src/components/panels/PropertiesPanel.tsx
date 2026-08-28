"use client";

import { Boxes, ChevronDown, ChevronUp, Layers, Link2, Trash2 } from "lucide-react";
import { RENDER_MODES, STATE_LIBS, UI_LIBS, findCatalog } from "@/lib/catalog";
import { canNestIntoContainer, isBlockNode, isContainerNode } from "@/lib/blocks";
import { FLOW_KIND_META, normalizeEdgeData } from "@/lib/edges";
import { freeLayerOrder } from "@/lib/sort-utils";
import { findFreeCatalog } from "@/lib/free-catalog";
import { useGraphStore } from "@/lib/graph-store";
import { TechIcon } from "@/lib/tech-icons";
import CustomSelect from "@/components/ui/Select";
import RichTextEditor from "@/components/ui/RichTextEditor";
import NodeColorPicker from "@/components/ui/NodeColorPicker";
import NodeShadowPicker from "@/components/ui/NodeShadowPicker";
import NodeIconPicker from "@/components/ui/NodeIconPicker";
import NodeGradientPicker from "@/components/ui/NodeGradientPicker";
import NodeFillPatternPicker from "@/components/ui/NodeFillPatternPicker";
import NodeAnnotations from "@/components/panels/NodeAnnotations";
import type {
  FailureBehavior,
  FirewallRule,
  FlowKind,
  FlowProtocol,
  FreeBorderStyle,
  FreeFillPattern,
  FreeFontStyle,
  FreeFontWeight,
  FreeHoverEffect,
  FreeTextAlign,
  FreeVerticalAlign,
  PiiSensitivity,
  C4Level,
} from "@/lib/types";
import { ALL_C4_LEVELS, isArchData, isBlockData, isFreeData, isZoneData } from "@/lib/types";
import { ZONE_META } from "@/lib/zones";

const FLOW_KINDS: FlowKind[] = ["sync", "async", "data", "control", "management"];
const PROTOCOLS: FlowProtocol[] = ["https", "grpc", "amqp", "kafka", "sql", "s3", "other"];
const FAILURE_BEHAVIORS: FailureBehavior[] = ["retry", "fallback", "dlq", "fail_fast", "none"];

const FAILURE_LABELS: Record<FailureBehavior, string> = {
  retry: "Retry",
  fallback: "Fallback",
  dlq: "DLQ",
  fail_fast: "Fail fast",
  none: "Nenhum",
};

export default function PropertiesPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const updateEdgeData = useGraphStore((s) => s.updateEdgeData);
  const renameNode = useGraphStore((s) => s.renameNode);
  const detachNode = useGraphStore((s) => s.detachNode);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const attachNodeToBlock = useGraphStore((s) => s.attachNodeToBlock);
  const moveFreeNodeLayer = useGraphStore((s) => s.moveFreeNodeLayer);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  if (selectedEdge) {
    const data = normalizeEdgeData(selectedEdge.data);
    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            <Link2 size={12} />
            Fluxo
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedEdge.source} → {selectedEdge.target}
          </p>
        </div>
        <SelectField
          label="Tipo de fluxo"
          value={data.flowKind}
          options={FLOW_KINDS}
          optionLabel={(v) => FLOW_KIND_META[v as FlowKind]?.label ?? v}
          onChange={(flowKind) => updateEdgeData(selectedEdge.id, { flowKind: flowKind as FlowKind })}
        />
        <SelectField
          label="Protocolo"
          value={data.protocol ?? "https"}
          options={PROTOCOLS}
          onChange={(protocol) => updateEdgeData(selectedEdge.id, { protocol: protocol as FlowProtocol })}
        />
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="flow-number">
            Número do fluxo
          </label>
          <input
            id="flow-number"
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={data.flowNumber ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Number(e.target.value);
              updateEdgeData(selectedEdge.id, { flowNumber: Number.isFinite(n) ? n : undefined });
            }}
          />
        </div>
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="flow-label">
            Label
          </label>
          <input
            id="flow-label"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={data.label ?? ""}
            onChange={(e) => updateEdgeData(selectedEdge.id, { label: e.target.value || undefined })}
            placeholder="Ex.: authorize, publish event"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-[var(--border-strong)]"
            checked={Boolean(data.isCriticalPath)}
            onChange={(e) => {
              const checked = e.target.checked;
              updateEdgeData(selectedEdge.id, { isCriticalPath: checked });
              const nfr = useGraphStore.getState().nfr;
              const ids = new Set(nfr.critical_path_edge_ids ?? []);
              if (checked) ids.add(selectedEdge.id);
              else ids.delete(selectedEdge.id);
              useGraphStore.getState().setNfr({ ...nfr, critical_path_edge_ids: [...ids] });
            }}
          />
          Caminho crítico
        </label>
        <SelectField
          label="Comportamento em falha"
          value={data.failureBehavior ?? "none"}
          options={FAILURE_BEHAVIORS}
          optionLabel={(v) => FAILURE_LABELS[v as FailureBehavior] ?? v}
          onChange={(failureBehavior) =>
            updateEdgeData(selectedEdge.id, {
              failureBehavior: failureBehavior as FailureBehavior,
            })
          }
        />
        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Regras de Firewall / Security Group
          </label>
          <div className="mt-2 space-y-2">
            {(data.firewallRules ?? []).map((rule: FirewallRule, idx: number) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={rule.port}
                  onChange={(e) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], port: e.target.value };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  placeholder="Porta"
                  className="w-20 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
                />
                <CustomSelect
                  value={rule.protocol}
                  options={[
                    { value: "tcp", label: "TCP" },
                    { value: "udp", label: "UDP" },
                    { value: "all", label: "ALL" },
                  ]}
                  onChange={(v) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], protocol: v as FirewallRule["protocol"] };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  className="w-20"
                />
                <CustomSelect
                  value={rule.direction}
                  options={[
                    { value: "inbound", label: "Inbound" },
                    { value: "outbound", label: "Outbound" },
                  ]}
                  onChange={(v) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], direction: v as FirewallRule["direction"] };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  className="w-24"
                />
                <input
                  type="text"
                  value={rule.description ?? ""}
                  onChange={(e) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  placeholder="Descrição..."
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = (data.firewallRules ?? []).filter((_, i) => i !== idx);
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const rules = data.firewallRules ?? [];
                updateEdgeData(selectedEdge.id, { firewallRules: [...rules, { port: "443", protocol: "tcp", direction: "inbound" }] });
              }}
              className="text-xs text-[var(--accent)] hover:text-indigo-300 flex items-center gap-2"
            >
              + Adicionar regra
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn-danger inline-flex w-full items-center justify-center gap-2"
          onClick={() => deleteSelected()}
        >
          <Trash2 size={14} />
          Remover fluxo
        </button>
      </div>
    );
  }

  const node = nodes.find((n) => n.id === selectedNodeId);
  const compatibleParents = nodes.filter((n) => {
    if (!isContainerNode(n) || !node) return false;
    return canNestIntoContainer(node, n, nodes);
  });

  if (!node) {
    return (
      <div className="space-y-3 px-4 py-6 text-sm text-[var(--muted-fg)]">
        <p className="font-medium text-slate-200">Nada selecionado</p>
        <p>Clique em uma zona, bloco, card ou fluxo no canvas.</p>
        <ul className="space-y-2 text-xs text-[var(--muted)]">
          <li className="flex gap-2">
            <Link2 size={12} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            Selecione uma linha para editar tipo/número/protocolo do fluxo.
          </li>
          <li className="flex gap-2">
            <Boxes size={12} className="mt-0.5 shrink-0 text-violet-300" />
            Ctrl+Z desfaz · Shift+Z refaz · botão Atalhos no canvas.
          </li>
        </ul>
      </div>
    );
  }

  if (isZoneData(node.data)) {
    const childCount = nodes.filter((n) => n.parentId === node.id).length;
    const meta = ZONE_META[node.data.zoneKind];
    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-indigo-300">
            <Layers size={12} />
            Zona · {meta.short}
          </p>
          <label className="mt-2 block text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="zone-label">
            Nome da zona
          </label>
          <input
            id="zone-label"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={node.data.label}
            onChange={(e) => renameNode(node.id, e.target.value)}
          />
        </div>
        {(node.data.zoneKind === "data_mesh" || node.data.boundedContext != null) && (
          <div>
            <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="bounded-context">
              Bounded context
            </label>
            <input
              id="bounded-context"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
              value={node.data.boundedContext ?? ""}
              onChange={(e) => updateNodeData(node.id, { boundedContext: e.target.value || undefined })}
              placeholder="Ex.: Orders, Billing"
            />
          </div>
        )}
        <p className="text-xs text-[var(--muted-fg)]">
          Tipo: <strong className="text-slate-200">{node.data.zoneKind}</strong>
          {node.data.provider ? ` · ${node.data.provider}` : ""}
          {" · "}
          {childCount} filho{childCount === 1 ? "" : "s"}
        </p>
        {childCount > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
              Filhos ({childCount})
            </p>
            <ul className="space-y-1">
              {nodes
                .filter((n) => n.parentId === node.id)
                .map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 text-xs"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/60" />
                    <span className="flex-1 truncate text-slate-200">
                      {isArchData(child.data) ? child.data.label : child.id}
                    </span>
                    <span className="text-[var(--muted)]">{child.type}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <p className="rounded-lg border border-[var(--border)] bg-black/20 p-3 text-xs leading-relaxed text-[var(--muted-fg)]">
          Aninhe AZs/subnets dentro de VPC, e serviços dentro das zonas. Redimensione pelas alças.
        </p>
        <button
          type="button"
          className="btn-danger inline-flex w-full items-center justify-center gap-2"
          onClick={() => deleteSelected()}
        >
          <Trash2 size={14} />
          Remover zona (mantém filhos soltos)
        </button>
      </div>
    );
  }

  if (isBlockData(node.data)) {
    const childCount = nodes.filter((n) => n.parentId === node.id).length;
    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-indigo-300">
            <Boxes size={12} />
            Bloco
          </p>
          <label className="mt-2 block text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="block-label">
            Nome do bloco
          </label>
          <input
            id="block-label"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={node.data.label}
            onChange={(e) => renameNode(node.id, e.target.value)}
            placeholder="Ex.: Frontend Web"
          />
        </div>
        <p className="text-xs text-[var(--muted-fg)]">
          Domínio: <strong className="text-slate-200">{node.data.domain}</strong>
          {" · "}
          {childCount} card{childCount === 1 ? "" : "s"} dentro
        </p>
        {childCount > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
              Cards dentro ({childCount})
            </p>
            <ul className="space-y-1">
              {nodes
                .filter((n) => n.parentId === node.id)
                .map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 text-xs"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/60" />
                    <span className="flex-1 truncate text-slate-200">
                      {isArchData(child.data) ? child.data.label : child.id}
                    </span>
                    <span className="text-[var(--muted)]">{child.type}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="btn-danger inline-flex w-full items-center justify-center gap-2"
          onClick={() => deleteSelected()}
        >
          <Trash2 size={14} />
          Remover bloco (mantém cards)
        </button>
      </div>
    );
  }

  if (isFreeData(node.data)) {
    const free = node.data;
    const childCount = nodes.filter((n) => n.parentId === node.id).length;
    const layer = freeLayerOrder(free, node.id);
    const catalog = findFreeCatalog(free.kind);
    const isMedia = ["free-image", "free-video", "free-audio"].includes(free.kind);
    const isLink = free.kind === "free-link";

    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-amber-300">
            <Layers size={12} />
            {catalog?.label ?? "Forma Livre"}
          </p>
          <label className="mt-2 block text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="free-label">
            Rótulo
          </label>
          <input
            id="free-label"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={free.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value.slice(0, 60) || "Novo" })}
          />
        </div>

        <div>
          <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="free-notes">
            Notas
          </label>
          <RichTextEditor
            id="free-notes"
            value={free.notes ?? ""}
            onChange={(html) => updateNodeData(node.id, { notes: html || undefined })}
            placeholder="Anotações sobre este elemento…"
            className="mt-1"
          />
        </div>

        {(isMedia || isLink) && (
          <div>
            <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="free-url">
              {isLink ? "URL do link" : "URL da mídia"}
            </label>
            <input
              id="free-url"
              type="url"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
              value={isLink ? (free.linkUrl ?? "") : (free.mediaUrl ?? "")}
              onChange={(e) =>
                updateNodeData(node.id, isLink ? { linkUrl: e.target.value } : { mediaUrl: e.target.value })
              }
              placeholder="https://…"
            />
          </div>
        )}

        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Aparência</p>
          <div className="grid grid-cols-2 gap-2">
            <NodeColorPicker
              label="Fundo"
              value={free.backgroundColor ?? "#1e293b"}
              onChange={(v) => updateNodeData(node.id, { backgroundColor: v })}
            />
            <NodeColorPicker
              label="Texto"
              value={free.textColor ?? "#f1f5f9"}
              onChange={(v) => updateNodeData(node.id, { textColor: v })}
            />
            <NodeColorPicker
              label="Borda"
              value={free.borderColor ?? "#334155"}
              onChange={(v) => updateNodeData(node.id, { borderColor: v })}
            />
            <div>
              <label className="text-xs text-[var(--muted-fg)]">Arredondamento</label>
              <input
                type="number"
                min={0}
                max={999}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                value={free.borderRadius ?? 8}
                onChange={(e) =>
                  updateNodeData(node.id, { borderRadius: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-[var(--muted-fg)] mb-1.5">Borda</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--muted)]">Espessura</label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  className="mt-1 w-full"
                  value={free.borderWidth ?? 2}
                  onChange={(e) =>
                    updateNodeData(node.id, { borderWidth: Number(e.target.value) })
                  }
                />
                <p className="text-[10px] text-[var(--muted)] text-right">{free.borderWidth ?? 2}px</p>
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted)]">Estilo</label>
                <div className="mt-1 flex gap-1">
                  {(["solid", "dashed", "dotted"] as FreeBorderStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      aria-pressed={(free.borderStyle ?? "solid") === style}
                      className={`flex-1 rounded border py-1 text-[10px] ${
                        (free.borderStyle ?? "solid") === style
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted-fg)]"
                      }`}
                      onClick={() => updateNodeData(node.id, { borderStyle: style })}
                    >
                      {style === "solid" ? "—" : style === "dashed" ? "- -" : "···"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-[var(--muted-fg)] mb-1.5">Tipografia</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--muted)]">Tamanho</label>
                <input
                  type="range"
                  min={12}
                  max={32}
                  step={1}
                  className="mt-1 w-full"
                  value={free.fontSize ?? 14}
                  onChange={(e) =>
                    updateNodeData(node.id, { fontSize: Number(e.target.value) })
                  }
                />
                <p className="text-[10px] text-[var(--muted)] text-right">{free.fontSize ?? 14}px</p>
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted)]">Peso</label>
                <div className="mt-1 flex gap-1">
                  {(["normal", "medium", "bold"] as FreeFontWeight[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={(free.fontWeight ?? "medium") === w}
                      className={`flex-1 rounded border py-1 text-[10px] ${
                        (free.fontWeight ?? "medium") === w
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted-fg)]"
                      }`}
                      onClick={() => updateNodeData(node.id, { fontWeight: w })}
                    >
                      {w === "normal" ? "N" : w === "medium" ? "M" : "B"}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex gap-1">
                  {(["normal", "italic"] as FreeFontStyle[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={(free.fontStyle ?? "normal") === s}
                      className={`flex-1 rounded border py-1 text-[10px] ${
                        (free.fontStyle ?? "normal") === s
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted-fg)]"
                      } ${s === "italic" ? "italic" : ""}`}
                      onClick={() => updateNodeData(node.id, { fontStyle: s })}
                    >
                      {s === "normal" ? "Romano" : "Itálico"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-[var(--muted-fg)] mb-1.5">Alinhamento</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--muted)]">Horizontal</label>
                <div className="mt-1 flex gap-1">
                  {(["left", "center", "right"] as FreeTextAlign[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={(free.textAlign ?? "center") === a}
                      className={`flex-1 rounded border py-1 text-[10px] ${
                        (free.textAlign ?? "center") === a
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted-fg)]"
                      }`}
                      onClick={() => updateNodeData(node.id, { textAlign: a })}
                    >
                      {a === "left" ? "Esq" : a === "center" ? "Centro" : "Dir"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted)]">Vertical</label>
                <div className="mt-1 flex gap-1">
                  {(["top", "center", "bottom"] as FreeVerticalAlign[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={(free.verticalAlign ?? "center") === a}
                      className={`flex-1 rounded border py-1 text-[10px] ${
                        (free.verticalAlign ?? "center") === a
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted-fg)]"
                      }`}
                      onClick={() => updateNodeData(node.id, { verticalAlign: a })}
                    >
                      {a === "top" ? "Topo" : a === "center" ? "Meio" : "Base"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <NodeShadowPicker
            value={free.shadow ?? "none"}
            onChange={(v) => updateNodeData(node.id, { shadow: v })}
          />

          <NodeIconPicker
            iconId={free.iconId}
            iconSize={free.iconSize ?? 16}
            color={free.textColor}
            onIconChange={(iconId) => updateNodeData(node.id, { iconId })}
            onSizeChange={(iconSize) => updateNodeData(node.id, { iconSize })}
          />

          <NodeGradientPicker
            value={free.backgroundGradient}
            onChange={(backgroundGradient) => updateNodeData(node.id, { backgroundGradient })}
          />

          <NodeFillPatternPicker
            value={(free.fillPattern ?? "none") as FreeFillPattern}
            onChange={(fillPattern) => updateNodeData(node.id, { fillPattern })}
          />

          <div>
            <p className="text-xs text-[var(--muted-fg)] mb-1.5">Efeito no hover</p>
            <div className="grid grid-cols-4 gap-1">
              {(["none", "glow", "scale", "shadow"] as FreeHoverEffect[]).map((effect) => (
                <button
                  key={effect}
                  type="button"
                  aria-pressed={(free.hoverEffect ?? "none") === effect}
                  className={`rounded border py-1.5 text-[10px] capitalize ${
                    (free.hoverEffect ?? "none") === effect
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted-fg)]"
                  }`}
                  onClick={() => updateNodeData(node.id, { hoverEffect: effect })}
                >
                  {effect === "none" ? "Nenhum" : effect}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--muted-fg)]">
              Opacidade · {Math.round((free.opacity ?? 1) * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              className="mt-1 w-full"
              value={Math.round((free.opacity ?? 1) * 100)}
              onChange={(e) =>
                updateNodeData(node.id, { opacity: Number(e.target.value) / 100 })
              }
            />
            {/* Rotation */}
            <label className="mt-2 text-xs text-[var(--muted-fg)]">
              Rotação (graus) {free.rotation ?? 0}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              className="mt-1 w-full"
              value={free.rotation ?? 0}
              onChange={(e) =>
                updateNodeData(node.id, { rotation: Number(e.target.value) })
              }
            />
          </div>

          {!isLink && (
            <div>
              <label className="text-xs text-[var(--muted-fg)]">Link opcional</label>
              <input
                type="url"
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 text-xs text-slate-100"
                value={free.linkUrl ?? ""}
                onChange={(e) => updateNodeData(node.id, { linkUrl: e.target.value || undefined })}
                placeholder="https://…"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
            Camada · #{layer}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => moveFreeNodeLayer(node.id, "front")}>
              <ChevronUp size={12} className="inline mr-1" />
              Frente
            </button>
            <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => moveFreeNodeLayer(node.id, "back")}>
              <ChevronDown size={12} className="inline mr-1" />
              Fundo
            </button>
            <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => moveFreeNodeLayer(node.id, "forward")}>
              ↑ Acima
            </button>
            <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => moveFreeNodeLayer(node.id, "backward")}>
              ↓ Abaixo
            </button>
          </div>
        </div>

        {childCount > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
              Elementos dentro ({childCount})
            </p>
            <ul className="space-y-1">
              {nodes
                .filter((n) => n.parentId === node.id)
                .sort((a, b) => {
                  const ao = isFreeData(a.data) ? freeLayerOrder(a.data, a.id) : 0;
                  const bo = isFreeData(b.data) ? freeLayerOrder(b.data, b.id) : 0;
                  return bo - ao;
                })
                .map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 text-xs hover:border-[var(--accent)]/40"
                      onClick={() => setSelectedNodeId(child.id)}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
                      <span className="flex-1 truncate text-left text-slate-200">
                        {isFreeData(child.data) ? child.data.label : child.id}
                      </span>
                      <span className="text-[var(--muted)]">
                        {isFreeData(child.data) ? findFreeCatalog(child.data.kind)?.label : child.type}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-[var(--muted-fg)]">
          Tipo: <strong className="text-slate-200">{free.kind}</strong>
          {" · "}
          Segure <kbd className="rounded bg-white/10 px-1">Shift</kbd> ao redimensionar para manter proporção
        </p>

        <NodeAnnotations nodeId={node.id} />

        <button
          type="button"
          className="btn-danger inline-flex w-full items-center justify-center gap-2"
          onClick={() => deleteSelected()}
        >
          <Trash2 size={14} />
          Remover forma
        </button>
      </div>
    );
  }

  if (!isArchData(node.data)) return null;

  const archData = node.data;
  const catalog = findCatalog(archData.catalogId);
  const cfg = archData.config;
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
  const stackBlocks = compatibleParents.filter((n) => isBlockNode(n));
  const zones = compatibleParents.filter((n) => isZoneData(n.data));

  return (
    <div className="space-y-3 px-4 py-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-violet-300">
          <TechIcon catalogId={node.data.catalogId} kind={node.data.kind} size={12} />
          Card
        </p>
        <label className="mt-2 block text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="node-label">
          Nome
        </label>
        <input
          id="node-label"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
          value={archData.label}
          onChange={(e) => renameNode(node.id, e.target.value)}
        />
      </div>
      {catalog?.description && <p className="text-xs text-[var(--muted)]">{catalog.description}</p>}

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="parent-block">
          <Boxes size={12} />
          Dentro de
        </label>
        <CustomSelect
          value={node.parentId ?? ""}
          options={[
            { value: "", label: "Nenhum (livre no canvas)" },
            ...zones.map((z) => ({
              value: z.id,
              label: `Zona · ${isZoneData(z.data) ? z.data.label : z.id}`,
            })),
            ...stackBlocks.map((block) => ({
              value: block.id,
              label: isBlockData(block.data) ? `Bloco · ${block.data.label}` : block.id,
            })),
          ]}
          onChange={(value) => {
            if (!value) detachNode(node.id);
            else attachNodeToBlock(node.id, value);
          }}
        />
        {parent && (isBlockData(parent.data) || isZoneData(parent.data)) && (
          <p className="mt-1 text-sm text-[var(--muted)]">Agora dentro de “{parent.data.label}”</p>
        )}
      </div>

      {archData.kind === "frontend" && (
        <>
          <SelectField
            label="Biblioteca UI"
            value={cfg.uiLib ?? "Tailwind"}
            options={UI_LIBS}
            onChange={(uiLib) => updateNodeConfig(node.id, { ...cfg, uiLib })}
          />
          <SelectField
            label="Estado"
            value={cfg.state ?? "Zustand"}
            options={STATE_LIBS}
            onChange={(state) => updateNodeConfig(node.id, { ...cfg, state })}
          />
          <SelectField
            label="Renderização"
            value={cfg.rendering ?? "CSR"}
            options={RENDER_MODES}
            onChange={(rendering) => updateNodeConfig(node.id, { ...cfg, rendering })}
          />
        </>
      )}

      {archData.kind === "backend" && (
        <p className="text-xs text-[var(--muted-fg)]">
          Framework: <strong className="text-slate-200">{cfg.framework}</strong>
        </p>
      )}
      {archData.kind === "database" && (
        <>
          <p className="text-xs text-[var(--muted-fg)]">
            Engine: <strong className="text-slate-200">{cfg.engine}</strong>
          </p>
          <SelectField
            label="Sensibilidade PII"
            value={archData.piiSensitivity ?? "none"}
            options={["none", "low", "medium", "high", "restricted"] as PiiSensitivity[]}
            onChange={(piiSensitivity) =>
              updateNodeData(node.id, { piiSensitivity: piiSensitivity as PiiSensitivity })
            }
          />
        </>
      )}

      <SelectField
        label="Nível C4"
        value={archData.c4Level ?? "container"}
        options={ALL_C4_LEVELS}
        onChange={(c4Level) => updateNodeData(node.id, { c4Level: c4Level as C4Level })}
      />

      <div>
        <label className="text-xs text-[var(--muted-fg)]">Link externo</label>
        <input
          type="url"
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 text-xs text-slate-100"
          value={archData.linkUrl ?? ""}
          onChange={(e) => updateNodeData(node.id, { linkUrl: e.target.value || undefined })}
          placeholder="https://…"
        />
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Contrato de capacidade</p>
        <input
          type="number"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100"
          placeholder="Max RPS"
          value={archData.capacityContract?.max_rps ?? ""}
          onChange={(e) =>
            updateNodeData(node.id, {
              capacityContract: {
                ...archData.capacityContract,
                max_rps: e.target.value ? Number(e.target.value) : undefined,
              },
            })
          }
        />
        <input
          type="number"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-slate-100"
          placeholder="P99 latency (ms)"
          value={archData.capacityContract?.p99_latency_ms ?? ""}
          onChange={(e) =>
            updateNodeData(node.id, {
              capacityContract: {
                ...archData.capacityContract,
                p99_latency_ms: e.target.value ? Number(e.target.value) : undefined,
              },
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Notas / Especificações
        </label>
        <p className="text-xs leading-relaxed text-[var(--muted-fg)]">
          Detalhe o que for específico deste card (tabelas, URLs, auth, formatos, etc.).
        </p>
        <RichTextEditor
          value={archData.notes ?? ""}
          onChange={(html) => updateNodeData(node.id, { notes: html || undefined })}
          placeholder="Ex.: Tabelas: users, courses… · Auth: email + senha · URLs: /curso/:id/video/:videoId"
        />
      </div>

      {(archData.kind === "cloud" || catalog?.provider) && (
        <p className="text-xs text-[var(--muted-fg)]">
          {cfg.provider ?? catalog?.provider} · {cfg.service ?? catalog?.capability}
        </p>
      )}

      <button
        type="button"
        className="btn-danger inline-flex w-full items-center justify-center gap-2"
        onClick={() => deleteSelected()}
      >
        <Trash2 size={14} />
        Remover card
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  optionLabel,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabel?: (value: string) => string;
}) {
  return (
    <div>
      <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">{label}</label>
      <CustomSelect
        className="mt-1"
        value={value}
        options={options.map((o) => ({ value: o, label: optionLabel ? optionLabel(o) : o }))}
        onChange={onChange}
      />
    </div>
  );
}
