import type { ClientSessionMutationResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { pauseSession } from '@/lib/sessions/service';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    const session = await pauseSession({ userId: context.userId });

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
