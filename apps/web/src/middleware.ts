import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { EMAIL_LOGIN_SESSION_COOKIE, getSafeNextPath, verifySignedEmailLoginSessionToken } from '@/lib/auth/email-challenge';

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
  const mfaBypassPrefixes = ['/login', '/register', '/forgot-password', '/reset-password', '/mfa', '/email-approval', '/auth/callback'];

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

    let emailTwoFactorEnabled = user.user_metadata?.email_2fa_enabled === true;

    if (typeof user.user_metadata?.email_2fa_enabled !== 'boolean') {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email_2fa_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profileData?.email_2fa_enabled) {
        emailTwoFactorEnabled = true;
      }
    }

    if (emailTwoFactorEnabled) {
      const loginSessionToken = request.cookies.get(EMAIL_LOGIN_SESSION_COOKIE)?.value;
      const loginSession = loginSessionToken ? await verifySignedEmailLoginSessionToken(loginSessionToken) : null;
      const currentSignInAt = user.last_sign_in_at ?? '';
      const hasValidEmailApprovalSession =
        loginSession?.userId === user.id &&
        loginSession.signInAt === currentSignInAt;

      if (!hasValidEmailApprovalSession) {
        const target = request.nextUrl.clone();
        target.pathname = '/email-approval';
        target.searchParams.set('next', getSafeNextPath(`${pathname}${request.nextUrl.search}`));
        const approvalResponse = NextResponse.redirect(target);

        if (loginSessionToken) {
          approvalResponse.cookies.set(EMAIL_LOGIN_SESSION_COOKIE, '', {
            httpOnly: true,
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        }

        return approvalResponse;
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
