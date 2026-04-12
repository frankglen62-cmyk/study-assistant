import type { AdminBulkUserActionResponse } from '@study-assistant/shared-types';

import { adminBulkUserActionSchema } from '@/lib/admin/schemas';
import { applyAdminBulkUserAction } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const body = await parseJsonBody(request, adminBulkUserActionSchema);
    assertRateLimit(`admin-users-bulk:${context.userId}`, { max: 60, windowMs: 60 * 60 * 1000 });

    const result = await applyAdminBulkUserAction({
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminBulkUserActionResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
