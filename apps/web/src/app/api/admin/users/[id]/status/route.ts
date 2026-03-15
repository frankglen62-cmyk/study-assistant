import type { AdminUserStatusRequest, AdminUserStatusResponse } from '@study-assistant/shared-types';

import { adminUserStatusSchema } from '@/lib/admin/schemas';
import { updateUserStatus } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit } from '@/lib/security/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const { id } = await params;
    const body = await parseJsonBody<AdminUserStatusRequest>(request, adminUserStatusSchema);
    assertRateLimit(`admin-user-status:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    const result = await updateUserStatus({
      userId: id,
      status: body.status,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminUserStatusResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
