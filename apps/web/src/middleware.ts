import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type MiddlewareCookie = {
  name: string;
  value: string;
  options?: Parameters<ReturnType<typeof NextResponse.next>['cookies']['set']>[2];
};

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({
      request,
    });
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: MiddlewareCookie[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const protectedPrefixes = ['/dashboard', '/buy-credits', '/sessions', '/usage-logs', '/settings', '/account', '/extension-guide', '/admin', '/audit-logs', '/categories', '/payments', '/reports', '/sources', '/subjects', '/users'];
  const mfaBypassPrefixes = ['/login', '/register', '/forgot-password', '/reset-password', '/mfa', '/auth/callback'];

  const isProtectedPath = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isMfaBypassPath = mfaBypassPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (user && isProtectedPath && !isMfaBypassPath) {
    const { data: assuranceData, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (!assuranceError && assuranceData.nextLevel === 'aal2' && assuranceData.currentLevel !== 'aal2') {
      const target = request.nextUrl.clone();
      target.pathname = '/mfa';
      target.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(target);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
