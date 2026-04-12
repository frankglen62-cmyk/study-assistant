import type {
  AdminUserFlagMutationResponse,
} from '@study-assistant/shared-types';

import { addAdminUserFlag, removeAdminUserFlag } from '@/lib/admin/service';
import { adminUserFlagCreateSchema, adminUserFlagDeleteSchema } from '@/lib/admin/schemas';
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
    const body = await parseJsonBody(request, adminUserFlagCreateSchema);
    assertRateLimit(`admin-user-flag:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    const result = await addAdminUserFlag({
      userId: id,
      flag: body.flag,
      color: body.color ?? null,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminUserFlagMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const { id } = await params;
    const body = await parseJsonBody(request, adminUserFlagDeleteSchema);
    assertRateLimit(`admin-user-flag:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    const result = await removeAdminUserFlag({
      userId: id,
      flagId: body.flagId,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminUserFlagMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
