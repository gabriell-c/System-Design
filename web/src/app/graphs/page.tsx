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
    <div className="flex h-screen items-center justify-center bg-[#070b10]">
      <p className="text-sm text-slate-400">Redirecionando para o dashboard…</p>
    </div>
  );
}
