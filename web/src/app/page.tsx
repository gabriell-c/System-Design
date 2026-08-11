"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EditorShell from "@/components/layout/EditorShell";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const { isAuthenticated, isLoading, fetchProfile } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#070b10]">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <EditorShell />;
}
