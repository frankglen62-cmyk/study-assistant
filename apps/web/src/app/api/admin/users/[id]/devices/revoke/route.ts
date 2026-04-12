import type {
  AdminUserDeviceRevokeResponse,
} from '@study-assistant/shared-types';

import { adminUserDeviceRevokeSchema } from '@/lib/admin/schemas';
import { revokeAdminUserDevices } from '@/lib/admin/service';
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
    const body = await parseJsonBody(request, adminUserDeviceRevokeSchema);
    assertRateLimit(`admin-user-device-revoke:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    const result = await revokeAdminUserDevices({
      userId: id,
      installationId: body.installationId ?? null,
      revokeAll: body.revokeAll ?? false,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminUserDeviceRevokeResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
