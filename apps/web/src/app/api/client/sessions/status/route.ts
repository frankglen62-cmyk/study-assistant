import type { ClientSessionMutationResponse, SessionStatus } from '@study-assistant/shared-types';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { getOpenSessionForUser } from '@/lib/supabase/sessions';
import { getWalletByUserId } from '@/lib/supabase/users';

/**
 * Lightweight polling endpoint — returns current session status + wallet
 * balance in one fast call. Called every 5s by the webapp to stay in sync
 * with the extension.
 *
 * SECURITY: The wallet balance is always read from the database (server
 * truth). The client can never inflate remaining time because:
 *   1. This endpoint reads `remaining_seconds` from the DB directly.
 *   2. Every analyze/session call re-validates credits server-side.
 *   3. The local countdown on the client is purely cosmetic.
 */
export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    // Generous rate limit for polling — 120 requests per 60s = 2/s max
    assertRateLimit(`session-status:${context.userId}`, { max: 120, windowMs: 60 * 1000 });

    const [openSession, wallet] = await Promise.all([
      getOpenSessionForUser(context.userId),
      getWalletByUserId(context.userId),
    ]);

    return jsonOk(
      {
        session: openSession
          ? {
              id: openSession.id,
              status: openSession.status as SessionStatus,
              startTime: openSession.start_time,
              detectionMode: openSession.detection_mode,
              usedSeconds: openSession.used_seconds,
            }
          : null,
        remainingSeconds: wallet.remaining_seconds,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
