"use client";

import NodeColorPicker from "@/components/ui/NodeColorPicker";
import type { FreeBackgroundGradient } from "@/lib/types";

const DIRECTIONS: { id: FreeBackgroundGradient["direction"]; label: string }[] = [
  { id: "to-right", label: "→" },
  { id: "to-bottom", label: "↓" },
  { id: "to-br", label: "↘" },
  { id: "to-bl", label: "↙" },
];

type Props = {
  value?: FreeBackgroundGradient;
  onChange: (value: FreeBackgroundGradient | undefined) => void;
};

export default function NodeGradientPicker({ value, onChange }: Props) {
  const enabled = Boolean(value);
  const from = value?.from ?? "#6366f1";
  const to = value?.to ?? "#22d3ee";
  const direction = value?.direction ?? "to-right";

  function patch(partial: Partial<FreeBackgroundGradient>) {
    onChange({ from, to, direction, ...partial });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted-fg)]">Gradiente</p>
        <button
          type="button"
          className={`text-xs px-2 py-0.5 rounded border ${
            enabled
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)]"
          }`}
          onClick={() =>
            onChange(enabled ? undefined : { from, to, direction })
          }
        >
          {enabled ? "Ativo" : "Ativar"}
        </button>
      </div>
      {enabled && (
        <>
          <div
            className="h-6 w-full rounded border border-[var(--border)]"
            style={{
              background: `linear-gradient(${cssDirection(direction)}, ${from}, ${to})`,
            }}
          />
          <div className="flex gap-1">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={direction === d.id}
                className={`flex-1 rounded border py-1 text-xs ${
                  direction === d.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/15"
                    : "border-[var(--border)]"
                }`}
                onClick={() => patch({ direction: d.id })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NodeColorPicker label="De" value={from} onChange={(v) => patch({ from: v })} />
            <NodeColorPicker label="Até" value={to} onChange={(v) => patch({ to: v })} />
          </div>
        </>
      )}
    </div>
  );
}

export function cssDirection(direction: FreeBackgroundGradient["direction"]): string {
  switch (direction) {
    case "to-bottom":
      return "to bottom";
    case "to-br":
      return "to bottom right";
    case "to-bl":
      return "to bottom left";
    default:
      return "to right";
  }
}
