"use client";

type Props = {
  className?: string;
  rows?: number;
};

export default function Skeleton({ className = "", rows = 3 }: Props) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4 w-full" style={{ width: `${100 - i * 12}%` }} />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
