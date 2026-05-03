import { z } from 'zod';

import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, RouteError } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { revokeAllInstallationsForUser } from '@/lib/supabase/extension';

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`revoke-all:${context.userId}`, { max: 5, windowMs: 60 * 60 * 1000 });

    const revokedCount = await revokeAllInstallationsForUser(context.userId);

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'extension.installation.revoked_all',
      entityType: 'extension_installations',
      entityId: context.userId,
      eventSummary: `Revoked all ${revokedCount} active installations.`,
      ipAddress,
      userAgent,
    });

    return jsonOk({ revoked: true, revokedCount }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
