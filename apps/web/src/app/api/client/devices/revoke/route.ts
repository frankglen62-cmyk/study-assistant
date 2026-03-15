import { z } from 'zod';

import type { DeviceRevokeRequest, DeviceRevokeResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { revokeInstallation } from '@/lib/supabase/extension';

const requestSchema = z.object({
  installationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client']);
    assertRateLimit(`revoke:${context.userId}`, { max: 20, windowMs: 60 * 60 * 1000 });
    const body = await parseJsonBody<DeviceRevokeRequest>(request, requestSchema);

    await revokeInstallation(body.installationId, context.userId);
    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'extension.installation.revoked',
      entityType: 'extension_installations',
      entityId: body.installationId,
      eventSummary: `Revoked extension installation ${body.installationId}.`,
      ipAddress,
      userAgent,
    });

    const response: DeviceRevokeResponse = {
      revoked: true,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
