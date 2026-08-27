"use client";

import { FREE_NODE_ICON_IDS, FREE_NODE_ICON_MAP } from "@/lib/free-icons";

const ICON_SIZES = [12, 16, 20, 24] as const;

type Props = {
  iconId?: string;
  iconSize?: number;
  color?: string;
  onIconChange: (iconId: string | undefined) => void;
  onSizeChange: (size: number) => void;
};

export default function NodeIconPicker({
  iconId,
  iconSize = 16,
  color = "currentColor",
  onIconChange,
  onSizeChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted-fg)]">Ícone</p>
        {iconId && (
          <button
            type="button"
            className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => onIconChange(undefined)}
          >
            Remover
          </button>
        )}
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-28 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface-1)] p-1.5">
        {FREE_NODE_ICON_IDS.map((id) => {
          const Icon = FREE_NODE_ICON_MAP[id];
          const selected = iconId === id;
          return (
            <button
              key={id}
              type="button"
              title={id}
              aria-pressed={selected}
              className={`flex h-7 w-7 items-center justify-center rounded ${
                selected
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : "text-[var(--muted-fg)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
              onClick={() => onIconChange(selected ? undefined : id)}
            >
              <Icon size={14} style={{ color: selected ? undefined : color }} />
            </button>
          );
        })}
      </div>
      <div>
        <p className="text-[10px] text-[var(--muted)] mb-1">Tamanho</p>
        <div className="flex gap-1">
          {ICON_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={iconSize === size}
              className={`flex-1 rounded border py-1 text-[10px] ${
                iconSize === size
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted-fg)]"
              }`}
              onClick={() => onSizeChange(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
