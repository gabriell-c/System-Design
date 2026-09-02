import { NextRequest, NextResponse } from 'next/server';

// Rotas públicas (sem autenticação necessária)
const PUBLIC_ROUTES = ['/login', '/register', '/recover', '/embed', '/share'];

// Rotas que precisam autenticação
const PROTECTED_ROUTES = ['/profile', '/graphs', '/compare', '/admin', '/project'];

// Rotas que permitem acesso público (leitura) se projeto for público
const PUBLIC_READ_ROUTES = ['/project'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verificar se é rota pública (login, register, etc.)
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Verificar autenticação via cookie
  const sessionCookie = request.cookies.get('session')?.value;
  const isAuthenticated = !!sessionCookie;

  // Se está autenticado, deixar passar
  if (isAuthenticated) {
    return NextResponse.next();
  }

  // Verificar se é rota protegida e usuário não está autenticado
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (!isAuthenticated && isProtectedRoute) {
    // EXCEÇÃO: Projetos públicos podem ser acessados em leitura sem login
    if (pathname.startsWith('/project/')) {
      // Permitir acesso, mas a página vai verificar se é público
      return NextResponse.next();
    }

    // Redirecionar para login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplicar middleware em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
