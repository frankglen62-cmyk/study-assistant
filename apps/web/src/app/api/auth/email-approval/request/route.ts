import { z } from 'zod';

import {
  EMAIL_LOGIN_REQUEST_COOKIE,
  buildEmailChallengeCookieOptions,
  createSignedEmailLoginRequestToken,
  getSafeNextPath,
} from '@/lib/auth/email-challenge';
import { env } from '@/lib/env/server';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

const requestSchema = z.object({
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
      throw new RouteError(401, 'unauthorized', 'You must be signed in to request email approval.');
    }

    const nextPath = getSafeNextPath(body.next, '/dashboard');
    const token = await createSignedEmailLoginRequestToken({
      userId: user.id,
      email: user.email,
      nextPath,
    });

    const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?flow=email-login-2fa&next=${encodeURIComponent(nextPath)}`;
    const response = jsonOk({ redirectTo }, requestId);

    response.cookies.set(EMAIL_LOGIN_REQUEST_COOKIE, token, buildEmailChallengeCookieOptions(15 * 60));

    return response;
  } catch (error) {
    return jsonError(error, requestId);
  }
}
