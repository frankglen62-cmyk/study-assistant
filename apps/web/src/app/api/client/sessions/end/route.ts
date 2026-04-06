import type { ClientSessionMutationResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { endSession, settleActiveSessionUsage } from '@/lib/sessions/service';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`session-end:${context.userId}`, { max: 30, windowMs: 60 * 60 * 1000 });
    const settled = await settleActiveSessionUsage({ userId: context.userId });
    const session =
      settled.session.status === 'active' || settled.session.status === 'paused'
        ? await endSession({ userId: context.userId, sessionId: settled.session.id })
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
