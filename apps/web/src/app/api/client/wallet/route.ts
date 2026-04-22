import type { ClientWalletResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_READ } from '@/lib/security/rate-limit';
import { settleActiveSessionUsage } from '@/lib/sessions/service';
import { getOpenSessionForUser } from '@/lib/supabase/sessions';
import { getWalletGrantOverviewForUser } from '@/lib/supabase/users';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`wallet:${context.userId}`, RL_CLIENT_READ);
    const openSession = await getOpenSessionForUser(context.userId);
    const remainingSeconds =
      openSession?.status === 'active'
        ? (await settleActiveSessionUsage({ userId: context.userId, sessionId: openSession.id })).wallet.remaining_seconds
        : context.wallet.remaining_seconds;
    const grantOverview = await getWalletGrantOverviewForUser(context.userId);

    const response: ClientWalletResponse = {
      remainingSeconds,
      nextExpiryAt: grantOverview.nextExpiryAt,
      expiringSeconds: grantOverview.expiringSeconds,
    };
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
