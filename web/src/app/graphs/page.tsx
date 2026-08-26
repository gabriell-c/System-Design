"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lista legada de graphs — o dashboard de projetos é a home. */
export default function GraphsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--background)]">
      <p className="text-sm text-[var(--muted-fg)]">Redirecionando para o dashboard…</p>
    </div>
  );
}
