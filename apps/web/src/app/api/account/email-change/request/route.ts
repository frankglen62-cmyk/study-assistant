import { z } from 'zod';

import {
  EMAIL_CHANGE_REQUEST_COOKIE,
  buildEmailChallengeCookieOptions,
  createSignedEmailChangeRequestToken,
  getSafeNextPath,
} from '@/lib/auth/email-challenge';
import { env } from '@/lib/env/server';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

const requestSchema = z.object({
  targetEmail: z.string().email('Enter a valid email address.'),
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

    if (userError || !user || !user.email) {
      throw new RouteError(401, 'unauthorized', 'You must be signed in to request an email change.');
    }

    if (user.email.toLowerCase() === body.targetEmail.toLowerCase()) {
      throw new RouteError(400, 'same_email', 'Enter a different email address.');
    }

    const nextPath = getSafeNextPath(body.next, '/account');
    const token = await createSignedEmailChangeRequestToken({
      userId: user.id,
      currentEmail: user.email,
      targetEmail: body.targetEmail,
      nextPath,
    });
    const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?flow=email-change-approval&next=${encodeURIComponent(nextPath)}`;
    const response = jsonOk({ redirectTo }, requestId);

    response.cookies.set(EMAIL_CHANGE_REQUEST_COOKIE, token, buildEmailChallengeCookieOptions(30 * 60));

    return response;
  } catch (error) {
    return jsonError(error, requestId);
  }
}
