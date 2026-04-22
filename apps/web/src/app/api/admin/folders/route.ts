import type { AdminFolderCreateRequest, AdminFolderMutationResponse } from '@study-assistant/shared-types';

import { adminFolderCreateSchema } from '@/lib/admin/schemas';
import { createFolder } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_MUTATE } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-folder:${context.userId}`, RL_ADMIN_MUTATE);
    const body = await parseJsonBody<AdminFolderCreateRequest>(request, adminFolderCreateSchema);
    const result = await createFolder({
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminFolderMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
