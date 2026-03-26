import { z } from 'zod';

import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { verifyOtp } from '@/lib/security/otp-service';
import {
  EMAIL_LOGIN_SESSION_COOKIE,
  buildEmailChallengeCookieOptions,
  createSignedEmailLoginSessionToken,
  getSafeNextPath,
} from '@/lib/auth/email-challenge';

const requestSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code.'),
  purpose: z.enum(['login_2fa', 'email_change_current', 'email_change_new', 'sensitive_action']).default('login_2fa'),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const body = await parseJsonBody(request, requestSchema);
    const supabase = await getSupabaseServerSessionClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new RouteError(401, 'unauthorized', 'You must be signed in.');
    }

    const purpose = body.purpose ?? 'login_2fa';
    await verifyOtp(user.id, purpose, body.code);

    const nextPath = getSafeNextPath(body.next ?? null, '/dashboard');

    // For login 2FA, set the session cookie so middleware allows access
    if (purpose === 'login_2fa') {
      const token = await createSignedEmailLoginSessionToken({
        userId: user.id,
        signInAt: user.last_sign_in_at ?? '',
      });

      const response = jsonOk({ verified: true, redirectTo: nextPath }, requestId);
      response.cookies.set(
        EMAIL_LOGIN_SESSION_COOKIE,
        token,
        buildEmailChallengeCookieOptions(30 * 24 * 60 * 60),
      );
      return response;
    }

    return jsonOk({ verified: true, redirectTo: nextPath }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
