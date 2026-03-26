import { z } from 'zod';

import {
  EMAIL_LOGIN_SESSION_COOKIE,
  buildEmailChallengeCookieOptions,
  buildExpiredEmailChallengeCookieOptions,
  createSignedEmailLoginSessionToken,
} from '@/lib/auth/email-challenge';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

const requestSchema = z.object({
  enabled: z.boolean(),
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
      throw new RouteError(401, 'unauthorized', 'You must be signed in to update email security.');
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        email_2fa_enabled: body.enabled,
      },
    });

    if (updateError) {
      throw new RouteError(500, 'profile_update_failed', 'Unable to update email approval settings.', updateError);
    }

    const admin = getSupabaseAdmin();
    const { error: profileSyncError } = await admin
      .from('profiles')
      .update({ email_2fa_enabled: body.enabled })
      .eq('id', user.id);

    if (profileSyncError) {
      throw new RouteError(500, 'profile_sync_failed', 'Auth setting updated but profile sync failed.', profileSyncError);
    }

    const response = jsonOk({ enabled: body.enabled }, requestId);

    if (body.enabled) {
      const token = await createSignedEmailLoginSessionToken({
        userId: user.id,
        signInAt: user.last_sign_in_at ?? '',
      });
      response.cookies.set(EMAIL_LOGIN_SESSION_COOKIE, token, buildEmailChallengeCookieOptions(30 * 24 * 60 * 60));
    } else {
      response.cookies.set(EMAIL_LOGIN_SESSION_COOKIE, '', buildExpiredEmailChallengeCookieOptions());
    }

    return response;
  } catch (error) {
    return jsonError(error, requestId);
  }
}
