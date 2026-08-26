import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FLOW_KIND_META } from "@/lib/edges";
import { ZONE_META } from "@/lib/zones";

interface DiagramLegendProps {
  className?: string;
  /** When false the legend is hidden behind a toggle. Default: true (shown). */
  open?: boolean;
  onToggle?: () => void;
  variant?: "overlay" | "floating";
}

const ZONE_KEYS = [
  "region" as const,
  "vpc" as const,
  "availability_zone" as const,
  "subnet_public" as const,
  "subnet_private" as const,
  "security_boundary" as const,
];

const FLOW_KEYS = Object.keys(FLOW_KIND_META) as (keyof typeof FLOW_KIND_META)[];

export default function DiagramLegend({ className = "", open: propOpen, onToggle, variant = "overlay" }: DiagramLegendProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = propOpen !== undefined ? propOpen : internalOpen;

  const toggle = () => {
    if (propOpen === undefined) setInternalOpen((v) => !v);
    onToggle?.();
  };

  const sectionTitle = "text-sm font-semibold uppercase tracking-wider text-[var(--muted-fg)]";
  const container = variant === "floating"
    ? "rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/95 px-3 py-2.5 text-sm text-[var(--muted)] backdrop-blur elev-2 max-w-[200px]"
    : "rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/95 px-3 py-2.5 text-sm text-[var(--muted)] backdrop-blur elev-2";

  if (variant === "floating") {
    return (
      <div className={`pointer-events-auto ${className}`}>
        <button
          type="button"
          onClick={toggle}
          className="mb-1 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/90 px-2 py-1 text-sm font-medium text-[var(--muted)] backdrop-blur transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          aria-label={open ? "Ocultar legenda" : "Mostrar legenda"}
        >
          {open ? <EyeOff size={12} /> : <Eye size={12} />}
          Legenda
        </button>
        {open && (
          <div className={container}>
            <p className={sectionTitle + " mb-1.5"}>Fluxos</p>
            <div className="space-y-1">
              {FLOW_KEYS.map((k) => {
                const m = FLOW_KIND_META[k];
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span
                      className="inline-block h-0.5 w-5 shrink-0"
                      style={{
                        background: m.stroke,
                        borderTop: m.dash ? `1px dashed ${m.stroke}` : undefined,
                      }}
                    />
                    <span>{m.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className={sectionTitle + " mb-1.5"}>Zonas</p>
              <div className="flex flex-wrap gap-2">
                {ZONE_KEYS.map((zk) => (
                  <span
                    key={zk}
                    className="rounded border px-2 py-0.5 text-sm font-medium"
                    style={{
                      background: ZONE_META[zk].bg,
                      borderColor: ZONE_META[zk].border,
                      color: ZONE_META[zk].accent,
                    }}
                  >
                    {ZONE_META[zk].short}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className={sectionTitle + " mb-1.5"}>Estado</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                  <span>Gargalo</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  <span>Aviso</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // overlay variant — compact inline legend (legacy)
  return (
    <div className={`pointer-events-auto ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="mb-1 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/90 px-2 py-1 text-sm font-medium text-[var(--muted)] backdrop-blur transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        aria-label={open ? "Ocultar legenda" : "Mostrar legenda"}
      >
        {open ? <EyeOff size={12} /> : <Eye size={12} />}
        Legenda
      </button>
      {open && (
        <div className={container}>
          <p className={sectionTitle + " mb-1.5"}>Fluxos</p>
          <div className="space-y-1">
            {FLOW_KEYS.map((k) => {
              const m = FLOW_KIND_META[k];
              return (
                <div key={k} className="flex items-center gap-2">
                  <span
                    className="inline-block h-0.5 w-5 shrink-0"
                    style={{
                      background: m.stroke,
                      borderTop: m.dash ? `1px dashed ${m.stroke}` : undefined,
                    }}
                  />
                  <span>{m.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <p className={sectionTitle + " mb-1.5"}>Zonas</p>
            <div className="flex flex-wrap gap-2">
              {ZONE_KEYS.map((zk) => (
                <span
                  key={zk}
                  className="rounded border px-2 py-0.5 text-sm font-medium"
                  style={{
                    background: ZONE_META[zk].bg,
                    borderColor: ZONE_META[zk].border,
                    color: ZONE_META[zk].accent,
                  }}
                >
                  {ZONE_META[zk].short}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <p className={sectionTitle + " mb-1.5"}>Estado</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                <span>Gargalo</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                <span>Aviso</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
