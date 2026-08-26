interface FlowBadgeProps {
  number: number;
  critical?: boolean;
  size?: "sm" | "md";
}

/** Badge circular para numeração contínua de fluxos (P0.2.2). */
export default function FlowBadge({ number, critical = false, size = "sm" }: FlowBadgeProps) {
  const dim = size === "md" ? "h-6 w-6 text-sm" : "h-5 w-5 text-sm";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-md ${dim} ${
        critical
          ? "bg-gradient-to-br from-pink-500 to-rose-600 ring-1 ring-pink-300/50"
          : "bg-gradient-to-br from-sky-500 to-cyan-600 ring-1 ring-sky-300/40"
      }`}
      aria-label={`Fluxo ${number}`}
    >
      {number}
    </span>
  );
}
