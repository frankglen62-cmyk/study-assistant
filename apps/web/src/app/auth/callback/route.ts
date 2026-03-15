import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

const supportedOtpTypes = new Set<EmailOtpType>(['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'email']);

function getSafeNextPath(candidate: string | null, fallback = '/dashboard') {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  return candidate;
}

function redirectWithError(origin: string, path: string, message: string) {
  const target = new URL(path, origin);
  target.searchParams.set('error', message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = getSafeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
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

    return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : nextPath, url.origin));
  }

  return redirectWithError(url.origin, '/login', 'The authentication link is invalid or incomplete.');
}
