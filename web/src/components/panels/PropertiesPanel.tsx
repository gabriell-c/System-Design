"use client";

import { Boxes, Layers, Link2, Trash2 } from "lucide-react";
import { RENDER_MODES, STATE_LIBS, UI_LIBS, findCatalog } from "@/lib/catalog";
import { canNestIntoContainer, isBlockNode, isContainerNode } from "@/lib/blocks";
import { FLOW_KIND_META, normalizeEdgeData } from "@/lib/edges";
import { useGraphStore } from "@/lib/graph-store";
import { TechIcon } from "@/lib/tech-icons";
import CustomSelect from "@/components/ui/Select";
import type { FailureBehavior, FirewallRule, FlowKind, FlowProtocol, NodeComment, PiiSensitivity, C4Level } from "@/lib/types";
import { ALL_C4_LEVELS, isArchData, isBlockData, isZoneData } from "@/lib/types";
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

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  if (selectedEdge) {
    const data = normalizeEdgeData(selectedEdge.data);
    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            <Link2 size={12} />
            Fluxo
          </p>
          <p className="mt-1 text-xs text-slate-500">
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
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="flow-number">
            Número do fluxo
          </label>
          <input
            id="flow-number"
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
            value={data.flowNumber ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Number(e.target.value);
              updateEdgeData(selectedEdge.id, { flowNumber: Number.isFinite(n) ? n : undefined });
            }}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="flow-label">
            Label
          </label>
          <input
            id="flow-label"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
            value={data.label ?? ""}
            onChange={(e) => updateEdgeData(selectedEdge.id, { label: e.target.value || undefined })}
            placeholder="Ex.: authorize, publish event"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-white/20"
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
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
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
                  className="w-20 rounded border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                />
                <select
                  value={rule.protocol}
                  onChange={(e) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], protocol: e.target.value as FirewallRule["protocol"] };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  className="rounded border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="all">ALL</option>
                </select>
                <select
                  value={rule.direction}
                  onChange={(e) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], direction: e.target.value as FirewallRule["direction"] };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  className="rounded border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                >
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
                <input
                  type="text"
                  value={rule.description ?? ""}
                  onChange={(e) => {
                    const updated = [...(data.firewallRules ?? [])];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    updateEdgeData(selectedEdge.id, { firewallRules: updated });
                  }}
                  placeholder="Descrição..."
                  className="flex-1 rounded border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
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
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
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
      <div className="space-y-3 px-4 py-6 text-sm text-slate-400">
        <p className="font-medium text-slate-200">Nada selecionado</p>
        <p>Clique em uma zona, bloco, card ou fluxo no canvas.</p>
        <ul className="space-y-2 text-xs text-slate-500">
          <li className="flex gap-2">
            <Link2 size={12} className="mt-0.5 shrink-0 text-cyan-400" />
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
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
            <Layers size={12} />
            Zona · {meta.short}
          </p>
          <label className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="zone-label">
            Nome da zona
          </label>
          <input
            id="zone-label"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
            value={node.data.label}
            onChange={(e) => renameNode(node.id, e.target.value)}
          />
        </div>
        {(node.data.zoneKind === "data_mesh" || node.data.boundedContext != null) && (
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="bounded-context">
              Bounded context
            </label>
            <input
              id="bounded-context"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
              value={node.data.boundedContext ?? ""}
              onChange={(e) => updateNodeData(node.id, { boundedContext: e.target.value || undefined })}
              placeholder="Ex.: Orders, Billing"
            />
          </div>
        )}
        <p className="text-xs text-slate-400">
          Tipo: <strong className="text-slate-200">{node.data.zoneKind}</strong>
          {node.data.provider ? ` · ${node.data.provider}` : ""}
          {" · "}
          {childCount} filho{childCount === 1 ? "" : "s"}
        </p>
        <p className="rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
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
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
            <Boxes size={12} />
            Bloco
          </p>
          <label className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="block-label">
            Nome do bloco
          </label>
          <input
            id="block-label"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
            value={node.data.label}
            onChange={(e) => renameNode(node.id, e.target.value)}
            placeholder="Ex.: Frontend Web"
          />
        </div>
        <p className="text-xs text-slate-400">
          Domínio: <strong className="text-slate-200">{node.data.domain}</strong>
          {" · "}
          {childCount} card{childCount === 1 ? "" : "s"} dentro
        </p>
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
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
          <TechIcon catalogId={node.data.catalogId} kind={node.data.kind} size={12} />
          Card
        </p>
        <label className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="node-label">
          Nome
        </label>
        <input
          id="node-label"
          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
          value={archData.label}
          onChange={(e) => renameNode(node.id, e.target.value)}
        />
      </div>
      {catalog?.description && <p className="text-xs text-slate-500">{catalog.description}</p>}

      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="parent-block">
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
          <p className="mt-1 text-[11px] text-slate-500">Agora dentro de “{parent.data.label}”</p>
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
        <p className="text-xs text-slate-400">
          Framework: <strong className="text-slate-200">{cfg.framework}</strong>
        </p>
      )}
      {archData.kind === "database" && (
        <>
          <p className="text-xs text-slate-400">
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

      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contrato de capacidade</p>
        <input
          type="number"
          className="w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100"
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
          className="w-full rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100"
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

      {(archData.kind === "cloud" || catalog?.provider) && (
        <p className="text-xs text-slate-400">
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
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</label>
      <CustomSelect
        className="mt-1"
        value={value}
        options={options.map((o) => ({ value: o, label: optionLabel ? optionLabel(o) : o }))}
        onChange={onChange}
      />
    </div>
  );
}
