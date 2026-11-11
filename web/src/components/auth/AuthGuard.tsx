"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

// Rotas públicas que não requerem autenticação
const PUBLIC_ROUTES = ["/login", "/register", "/recover"];

// Rotas que permitem acesso sem login (projetos públicos)
const PUBLIC_READ_ROUTES = ["/project/"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, fetchProfile } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Verificar autenticação ao carregar
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    // Se já carregou e não está autenticado, redirecionar para login
    if (!authLoading && !isAuthenticated) {
      // Verificar se é uma rota pública
      const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route));
      const isPublicReadRoute = PUBLIC_READ_ROUTES.some(route => pathname.startsWith(route));
      
      // Se não é pública, redirecionar para login
      if (!isPublicRoute && !isPublicReadRoute) {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, authLoading, pathname, router, fetchProfile]);

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "#060913" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
      </div>
    );
  }

  // Se não está autenticado e não é rota pública, não renderizar conteúdo
  if (!isAuthenticated) {
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route));
    const isPublicReadRoute = PUBLIC_READ_ROUTES.some(route => pathname.startsWith(route));
    if (!isPublicRoute && !isPublicReadRoute) {
      return null;
    }
  }

  return <>{children}</>;
}
