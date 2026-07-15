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
import { generateAndSendOtp, verifyOtp } from '@/lib/security/otp-service';

const requestSchema = z.object({
  enabled: z.boolean(),
  code: z.string().regex(/^\d{6}$/).optional(),
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

    const currentlyEnabled = user.user_metadata?.email_2fa_enabled === true;
    if (!body.enabled && currentlyEnabled) {
      if (!body.code) {
        if (!user.email) {
          throw new RouteError(400, 'email_missing', 'A verified email is required to disable email 2FA.');
        }

        try {
          await generateAndSendOtp(user.id, user.email, 'sensitive_action');
        } catch (error) {
          throw new RouteError(
            429,
            'otp_delivery_limited',
            error instanceof Error ? error.message : 'Unable to send a verification code right now.',
          );
        }
        throw new RouteError(
          428,
          'otp_required',
          'Enter the 6-digit code sent to your email to disable email 2FA.',
        );
      }

      try {
        await verifyOtp(user.id, 'sensitive_action', body.code);
      } catch (error) {
        throw new RouteError(
          400,
          'otp_invalid',
          error instanceof Error ? error.message : 'The verification code is invalid.',
        );
      }
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
      const rollback = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          email_2fa_enabled: currentlyEnabled,
        },
      });
      throw new RouteError(
        500,
        'profile_sync_failed',
        rollback.error
          ? 'Email security update could not be synchronized. Contact support before signing out.'
          : 'Email security update was rolled back because profile synchronization failed.',
        profileSyncError,
      );
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
