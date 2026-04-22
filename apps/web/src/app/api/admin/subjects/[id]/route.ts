import type { AdminSubjectMutationRequest, AdminSubjectMutationResponse } from '@study-assistant/shared-types';

import { adminSubjectMutationSchema } from '@/lib/admin/schemas';
import { deleteSubjectLibrary, updateSubject } from '@/lib/admin/service';
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
    assertRateLimit(`admin-subject:${context.userId}`, RL_ADMIN_MUTATE);
    const body = await parseJsonBody<AdminSubjectMutationRequest>(request, adminSubjectMutationSchema);
    const { id } = await params;
    const result = await updateSubject({
      subjectId: id,
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminSubjectMutationResponse = {
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
    assertRateLimit(`admin-subject:${context.userId}`, RL_ADMIN_MUTATE);
    const { id } = await params;
    const result = await deleteSubjectLibrary({
      subjectId: id,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminSubjectMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
