import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import {
  EMAIL_CHANGE_REQUEST_COOKIE,
  EMAIL_LOGIN_REQUEST_COOKIE,
  EMAIL_LOGIN_SESSION_COOKIE,
  buildEmailChallengeCookieOptions,
  buildExpiredEmailChallengeCookieOptions,
  createSignedEmailLoginSessionToken,
  getSafeNextPath,
  verifySignedEmailChangeRequestToken,
  verifySignedEmailLoginRequestToken,
} from '@/lib/auth/email-challenge';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

const supportedOtpTypes = new Set<EmailOtpType>(['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'email']);

function redirectWithError(origin: string, path: string, message: string) {
  const target = new URL(path, origin);
  target.searchParams.set('error', message);
  return NextResponse.redirect(target);
}

function appendStatus(path: string, key: string, value: string) {
  const url = new URL(path, 'https://study-assistant.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextPath = getSafeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const flow = url.searchParams.get('flow');
  const supabase = await getSupabaseServerSessionClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectWithError(url.origin, '/login', 'The sign-in link is invalid or has expired.');
    }

    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  if (tokenHash && type && supportedOtpTypes.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      return redirectWithError(
        url.origin,
        type === 'recovery' ? '/forgot-password' : '/login',
        type === 'recovery' ? 'The password reset link is invalid or has expired.' : 'The authentication link is invalid or has expired.',
      );
    }

    if (flow === 'email-login-2fa') {
      const approvalToken = request.cookies.get(EMAIL_LOGIN_REQUEST_COOKIE)?.value;
      const approvalPayload = approvalToken ? await verifySignedEmailLoginRequestToken(approvalToken) : null;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!approvalPayload || !user || approvalPayload.userId !== user.id || approvalPayload.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
        const response = redirectWithError(url.origin, '/login', 'The email approval link is invalid or has expired.');
        response.cookies.set(EMAIL_LOGIN_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
        return response;
      }

      const response = NextResponse.redirect(new URL(approvalPayload.nextPath, url.origin));
      const sessionToken = await createSignedEmailLoginSessionToken({
        userId: user.id,
        signInAt: user.last_sign_in_at ?? '',
      });

      response.cookies.set(EMAIL_LOGIN_SESSION_COOKIE, sessionToken, buildEmailChallengeCookieOptions(30 * 24 * 60 * 60));
      response.cookies.set(EMAIL_LOGIN_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
      return response;
    }

    if (flow === 'email-change-approval') {
      const approvalToken = request.cookies.get(EMAIL_CHANGE_REQUEST_COOKIE)?.value;
      const approvalPayload = approvalToken ? await verifySignedEmailChangeRequestToken(approvalToken) : null;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (
        !approvalPayload ||
        !user ||
        approvalPayload.userId !== user.id ||
        approvalPayload.currentEmail.toLowerCase() !== (user.email ?? '').toLowerCase()
      ) {
        const response = redirectWithError(url.origin, nextPath, 'The email-change approval link is invalid or has expired.');
        response.cookies.set(EMAIL_CHANGE_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
        return response;
      }

      const { error: updateError } = await supabase.auth.updateUser(
        { email: approvalPayload.targetEmail },
        {
          emailRedirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(appendStatus(approvalPayload.nextPath, 'email-change', 'confirmed'))}`,
        },
      );

      if (updateError) {
        const response = redirectWithError(url.origin, approvalPayload.nextPath, 'Unable to start the secure email change flow.');
        response.cookies.set(EMAIL_CHANGE_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
        return response;
      }

      const response = NextResponse.redirect(new URL(appendStatus(approvalPayload.nextPath, 'email-change', 'requested'), url.origin));
      const sessionToken = await createSignedEmailLoginSessionToken({
        userId: user.id,
        signInAt: user.last_sign_in_at ?? '',
      });

      response.cookies.set(EMAIL_LOGIN_SESSION_COOKIE, sessionToken, buildEmailChallengeCookieOptions(30 * 24 * 60 * 60));
      response.cookies.set(EMAIL_CHANGE_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
      return response;
    }

    return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : nextPath, url.origin));
  }

  return redirectWithError(url.origin, '/login', 'The authentication link is invalid or incomplete.');
}
