"use client";

import {
  Boxes,
  Link2,
  Trash2,
} from "lucide-react";
import { RENDER_MODES, STATE_LIBS, UI_LIBS, findCatalog } from "@/lib/catalog";
import { blockDomainOf, canNestCardInBlock, isBlockNode } from "@/lib/blocks";
import { useGraphStore } from "@/lib/graph-store";
import { TechIcon } from "@/lib/tech-icons";
import CustomSelect from "@/components/ui/Select";
import { isArchData, isBlockData } from "@/lib/types";

export default function PropertiesPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig);
  const renameNode = useGraphStore((s) => s.renameNode);
  const detachNode = useGraphStore((s) => s.detachNode);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const attachNodeToBlock = useGraphStore((s) => s.attachNodeToBlock);
  const node = nodes.find((n) => n.id === selectedNodeId);
  const compatibleBlocks = nodes.filter((n) => {
    if (!isBlockNode(n) || !node || !isArchData(node.data)) return false;
    const domain = blockDomainOf(n);
    return domain != null && canNestCardInBlock(node.data.kind, domain);
  });

  if (!node) {
    return (
      <div className="space-y-3 px-4 py-6 text-sm text-slate-400">
        <p className="font-medium text-slate-200">Nada selecionado</p>
        <p>
          Clique em um bloco ou card no canvas. Renomeie, mova cards para blocos e ligue os pontos.
        </p>
        <ul className="space-y-2 text-xs text-slate-500">
          <li className="flex gap-2">
            <Link2 size={12} className="mt-0.5 shrink-0 text-cyan-400" />
            Duplo clique no ponto (ou na linha) remove a ligação.
          </li>
          <li className="flex gap-2">
            <Boxes size={12} className="mt-0.5 shrink-0 text-violet-300" />
            Ctrl+Z desfaz · Shift+Z refaz · botão Atalhos no canvas.
          </li>
        </ul>
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
        <p className="rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
          Arraste cards <strong>do mesmo domínio</strong> para dentro deste bloco (ex.: só Frontend aqui). Ligue
          os pontos do bloco a outros blocos ou cards. Redimensione pelas alças quando selecionado.
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

  const catalog = findCatalog(node.data.catalogId);
  const cfg = node.data.config;
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;

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
          value={node.data.label}
          onChange={(e) => renameNode(node.id, e.target.value)}
        />
      </div>
      {catalog?.description && <p className="text-xs text-slate-500">{catalog.description}</p>}

      <div>
        <label
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"
          htmlFor="parent-block"
        >
          <Boxes size={12} />
          Dentro do bloco
        </label>
        <CustomSelect
          value={node.parentId ?? ""}
          options={[
            { value: "", label: "Nenhum (livre no canvas)" },
            ...compatibleBlocks.map((block) => ({
              value: block.id,
              label: isBlockData(block.data) ? block.data.label : block.id,
            })),
          ]}
          onChange={(value) => {
            if (!value) detachNode(node.id);
            else attachNodeToBlock(node.id, value);
          }}
        />
        {compatibleBlocks.length === 0 && (
          <p className="mt-1 text-[11px] text-amber-300/90">
            Não há bloco {node.data.kind} no canvas. Crie um bloco compatível antes de aninhar.
          </p>
        )}
        {parent && isBlockData(parent.data) && (
          <p className="mt-1 text-[11px] text-slate-500">Agora dentro de “{parent.data.label}”</p>
        )}
      </div>

      {node.data.kind === "frontend" && (
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

      {node.data.kind === "backend" && (
        <p className="text-xs text-slate-400">
          Framework: <strong className="text-slate-200">{cfg.framework}</strong>
        </p>
      )}
      {node.data.kind === "database" && (
        <p className="text-xs text-slate-400">
          Engine: <strong className="text-slate-200">{cfg.engine}</strong>
        </p>
      )}
      {node.data.kind === "cloud" && (
        <p className="text-xs text-slate-400">
          {cfg.provider} · {cfg.service}
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
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <CustomSelect className="mt-1" value={value} options={options} onChange={onChange} />
    </div>
  );
}
