"use client";

type Props = {
  isFreeMode: boolean;
};

/** Visual indicator of Free vs Structured mode (T3). */
export default function ModeBadge({ isFreeMode }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${
        isFreeMode
          ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
          : "border-indigo-400/40 bg-indigo-500/15 text-indigo-100"
      }`}
      role="status"
      aria-label={isFreeMode ? "Modo diagrama livre" : "Modo arquitetura estruturada"}
      data-testid="mode-badge"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isFreeMode ? "bg-amber-400" : "bg-indigo-400"}`}
        aria-hidden
      />
      {isFreeMode ? "Livre" : "Arquitetura"}
    </span>
  );
}
