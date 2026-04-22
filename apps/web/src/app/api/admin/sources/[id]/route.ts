import type { AdminSourceMetadataRequest, AdminSourceMutationResponse } from '@study-assistant/shared-types';

import { adminSourceMetadataSchema } from '@/lib/admin/schemas';
import { updateSourceMetadata } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_MUTATE } from '@/lib/security/rate-limit';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-source:${context.userId}`, RL_ADMIN_MUTATE);
    const body = await parseJsonBody<AdminSourceMetadataRequest>(request, adminSourceMetadataSchema);
    const { id } = await params;
    const result = await updateSourceMetadata({
      sourceId: id,
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminSourceMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
