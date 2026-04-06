import type { ClientWalletResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { settleActiveSessionUsage } from '@/lib/sessions/service';
import { getOpenSessionForUser } from '@/lib/supabase/sessions';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    const openSession = await getOpenSessionForUser(context.userId);
    const remainingSeconds =
      openSession?.status === 'active'
        ? (await settleActiveSessionUsage({ userId: context.userId, sessionId: openSession.id })).wallet.remaining_seconds
        : context.wallet.remaining_seconds;

    const response: ClientWalletResponse = {
      remainingSeconds,
    };
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
