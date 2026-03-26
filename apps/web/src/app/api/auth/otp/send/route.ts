import { z } from 'zod';

import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { generateAndSendOtp } from '@/lib/security/otp-service';

const requestSchema = z.object({
  purpose: z.enum(['login_2fa', 'email_change_current', 'email_change_new', 'sensitive_action']).default('login_2fa'),
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
      throw new RouteError(401, 'unauthorized', 'You must be signed in.');
    }

    const result = await generateAndSendOtp(user.id, user.email, body.purpose ?? 'login_2fa');

    return jsonOk(result, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
