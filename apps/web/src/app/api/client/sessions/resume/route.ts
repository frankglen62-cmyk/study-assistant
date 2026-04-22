import type { ClientSessionMutationResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_MUTATE } from '@/lib/security/rate-limit';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { resumeSession } from '@/lib/sessions/service';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`session-resume:${context.userId}`, RL_CLIENT_MUTATE);
    const session = await resumeSession({
      userId: context.userId,
      remainingSeconds: context.wallet.remaining_seconds,
      walletStatus: context.wallet.status,
    });

    const response: ClientSessionMutationResponse = {
      sessionId: session.id,
      status: toExtensionSessionStatus(session.status),
      remainingSeconds: context.wallet.remaining_seconds,
      detectionMode: session.detection_mode,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
