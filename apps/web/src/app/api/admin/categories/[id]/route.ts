import type { AdminCategoryMutationRequest, AdminCategoryMutationResponse } from '@study-assistant/shared-types';

import { adminCategoryMutationSchema } from '@/lib/admin/schemas';
import { updateCategory } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const body = await parseJsonBody<AdminCategoryMutationRequest>(request, adminCategoryMutationSchema);
    const { id } = await params;
    const result = await updateCategory({
      categoryId: id,
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminCategoryMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
