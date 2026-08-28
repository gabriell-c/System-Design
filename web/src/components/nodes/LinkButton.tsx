"use client";

import { Link2 } from "lucide-react";
import { memo } from "react";

const LinkButton = memo(function LinkButton({ href }: { href: string }) {
  if (!href || href === "https://") return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir link"
      aria-label="Abrir link externo"
      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--accent)]/80 text-white opacity-0 transition-opacity hover:bg-[var(--accent)] group-hover:opacity-100 focus:opacity-100"
    >
      <Link2 size={12} aria-hidden />
    </a>
  );
});

export default LinkButton;
