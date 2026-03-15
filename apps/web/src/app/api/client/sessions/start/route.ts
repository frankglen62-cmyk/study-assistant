import type { ClientSessionMutationResponse } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { startSession } from '@/lib/sessions/service';
import { getClientSettingsByUserId } from '@/lib/supabase/client-settings';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`session-start:${context.userId}`, { max: 20, windowMs: 60 * 60 * 1000 });
    const settings = await getClientSettingsByUserId(context.userId);
    const session = await startSession({
      userId: context.userId,
      installationId: 'installationId' in context ? context.installationId : null,
      remainingSeconds: context.wallet.remaining_seconds,
      walletStatus: context.wallet.status,
      detectionMode: settings.detectionMode,
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
