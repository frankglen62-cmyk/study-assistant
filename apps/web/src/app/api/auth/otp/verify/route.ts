import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { verifyOtp } from '@/lib/security/otp-service';
import { assertRateLimit, RL_AUTH_VERIFY } from '@/lib/security/rate-limit';
import {
  EMAIL_CHANGE_REQUEST_COOKIE,
  EMAIL_LOGIN_SESSION_COOKIE,
  buildEmailChallengeCookieOptions,
  buildExpiredEmailChallengeCookieOptions,
  createSignedEmailChangeRequestToken,
  createSignedEmailLoginSessionToken,
  getSafeNextPath,
  verifySignedEmailChangeRequestToken,
} from '@/lib/auth/email-challenge';
import { env } from '@/lib/env/server';
import { sendEmailChangeConfirmationEmail } from '@/lib/security/email-service';

const requestSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code.'),
  purpose: z.enum(['login_2fa', 'email_change_current', 'email_change_new', 'sensitive_action']).default('login_2fa'),
  next: z.string().optional(),
});

function appendStatus(path: string, key: string, value: string) {
  const url = new URL(path, 'https://study-assistant.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function appendPendingEmail(path: string, pendingEmail: string) {
  const url = new URL(path, 'https://study-assistant.local');
  url.searchParams.set('pending-email', pendingEmail);
  return `${url.pathname}${url.search}`;
}

export async function POST(request: NextRequest) {
  const { requestId, ipAddress } = getRequestMeta(request);

  try {
    assertRateLimit(`otp-verify:ip:${ipAddress ?? 'unknown'}`, RL_AUTH_VERIFY);
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

    if (purpose === 'email_change_current') {
      const approvalToken = request.cookies.get(EMAIL_CHANGE_REQUEST_COOKIE)?.value;
      const approvalPayload = approvalToken ? await verifySignedEmailChangeRequestToken(approvalToken) : null;

      if (
        !approvalPayload ||
        approvalPayload.userId !== user.id ||
        approvalPayload.currentEmail.toLowerCase() !== (user.email ?? '').toLowerCase()
      ) {
        const response = jsonError(
          new RouteError(400, 'invalid_email_change', 'The email-change request is invalid or has expired.'),
          requestId,
        );
        response.cookies.set(EMAIL_CHANGE_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
        return response;
      }

      const confirmedPath = appendPendingEmail(
        appendStatus(approvalPayload.nextPath, 'email-change', 'confirmed'),
        approvalPayload.targetEmail,
      );
      const confirmationToken = await createSignedEmailChangeRequestToken({
        userId: approvalPayload.userId,
        currentEmail: approvalPayload.currentEmail,
        targetEmail: approvalPayload.targetEmail,
        nextPath: approvalPayload.nextPath,
      });
      const confirmUrl = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?flow=email-change-complete&change_token=${encodeURIComponent(
        confirmationToken,
      )}&next=${encodeURIComponent(confirmedPath)}`;

      await sendEmailChangeConfirmationEmail({
        currentEmail: approvalPayload.currentEmail,
        newEmail: approvalPayload.targetEmail,
        confirmUrl,
      });

      const response = jsonOk(
        {
          verified: true,
          redirectTo: appendPendingEmail(
            appendStatus(approvalPayload.nextPath, 'email-change', 'requested'),
            approvalPayload.targetEmail,
          ),
        },
        requestId,
      );
      response.cookies.set(EMAIL_CHANGE_REQUEST_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
      return response;
    }

    return jsonOk({ verified: true, redirectTo: nextPath }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
