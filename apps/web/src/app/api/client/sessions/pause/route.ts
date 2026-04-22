import type { ClientSessionMutationResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_MUTATE } from '@/lib/security/rate-limit';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { pauseSession, settleActiveSessionUsage } from '@/lib/sessions/service';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`session-pause:${context.userId}`, RL_CLIENT_MUTATE);
    const settled = await settleActiveSessionUsage({ userId: context.userId });
    const session =
      settled.session.status === 'active'
        ? await pauseSession({ userId: context.userId, sessionId: settled.session.id })
        : settled.session;

    const response: ClientSessionMutationResponse = {
      sessionId: session.id,
      status: toExtensionSessionStatus(session.status),
      remainingSeconds: settled.wallet.remaining_seconds,
      detectionMode: session.detection_mode,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
