"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import SidebarNav from "./SidebarNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#070b10] text-slate-100">
      <SidebarNav />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
            </div>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </Suspense>
      </main>
    </div>
  );
}
