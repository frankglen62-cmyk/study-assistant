import type {
  AdminSubjectQaPairMutationResponse,
  AdminSubjectQaPairUpdateRequest,
} from '@study-assistant/shared-types';

import { adminSubjectQaPairUpdateSchema } from '@/lib/admin/schemas';
import { updateSubjectQaPair } from '@/lib/admin/service';
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
    assertRateLimit(`admin-qa-mutate:${context.userId}`, RL_ADMIN_MUTATE);
    const body = await parseJsonBody<AdminSubjectQaPairUpdateRequest>(request, adminSubjectQaPairUpdateSchema);
    const { id } = await params;
    const result = await updateSubjectQaPair({
      pairId: id,
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminSubjectQaPairMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
