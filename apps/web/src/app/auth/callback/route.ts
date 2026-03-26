import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import {
  EMAIL_LOGIN_REQUEST_COOKIE,
  EMAIL_LOGIN_SESSION_COOKIE,
  buildEmailChallengeCookieOptions,
  buildExpiredEmailChallengeCookieOptions,
  createSignedEmailLoginSessionToken,
  getSafeNextPath,
  verifySignedEmailChangeRequestToken,
  verifySignedEmailLoginRequestToken,
} from '@/lib/auth/email-challenge';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

const supportedOtpTypes = new Set<EmailOtpType>(['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'email']);

function redirectWithError(origin: string, path: string, message: string) {
  const target = new URL(path, origin);
  target.searchParams.set('error', message);
  return NextResponse.redirect(target);
}

function redirectToLoginWithNext(origin: string, nextPath: string, message: string) {
  const target = new URL('/login', origin);
  target.searchParams.set('next', nextPath);
  target.searchParams.set('message', message);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextPath = getSafeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const changeToken = url.searchParams.get('change_token');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const flow = url.searchParams.get('flow');
  const supabase = await getSupabaseServerSessionClient();
  const nextUrl = new URL(nextPath, 'https://study-assistant.local');
  const emailChangeStatus = nextUrl.searchParams.get('email-change');

  if (flow === 'email-change-complete') {
    if (!changeToken) {
      return redirectWithError(url.origin, '/login', 'The email confirmation link is invalid or incomplete.');
    }

    const approvalPayload = await verifySignedEmailChangeRequestToken(changeToken);

    if (!approvalPayload) {
      return redirectWithError(url.origin, '/login', 'The email confirmation link is invalid or has expired.');
    }

    const admin = getSupabaseAdmin();
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(approvalPayload.userId);

    if (userError || !userResult.user) {
      return redirectWithError(url.origin, '/login', 'Unable to load the email change request.');
    }

    const currentAuthEmail = userResult.user.email?.toLowerCase() ?? '';
    const targetEmail = approvalPayload.targetEmail.toLowerCase();

    if (currentAuthEmail !== targetEmail) {
      const { error: updateError } = await admin.auth.admin.updateUserById(approvalPayload.userId, {
        email: approvalPayload.targetEmail,
        email_confirm: true,
      });

      if (updateError) {
        return redirectWithError(url.origin, '/login', updateError.message || 'Unable to confirm your new email.');
      }
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ email: approvalPayload.targetEmail })
      .eq('id', approvalPayload.userId);

    if (profileError) {
      return redirectWithError(url.origin, '/login', 'Your email was updated, but the profile mirror could not be synced.');
    }

    return redirectToLoginWithNext(
      url.origin,
      getSafeNextPath(url.searchParams.get('next'), approvalPayload.nextPath),
      'Email confirmed. Sign in with your new email to continue.',
    );
  }

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

    return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : nextPath, url.origin));
  }

  if (emailChangeStatus === 'confirmed') {
    return redirectToLoginWithNext(
      url.origin,
      nextPath,
      'Email confirmed. Sign in with your new email to continue.',
    );
  }

  return redirectWithError(url.origin, '/login', 'The authentication link is invalid or incomplete.');
}
