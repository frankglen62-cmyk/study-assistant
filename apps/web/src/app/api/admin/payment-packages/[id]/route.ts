import type { AdminPaymentPackageMutationResponse, AdminPaymentPackageUpdateRequest } from '@study-assistant/shared-types';

import { adminPaymentPackageUpdateSchema } from '@/lib/admin/schemas';
import { deletePaymentPackage, updatePaymentPackage } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const body = await parseJsonBody<AdminPaymentPackageUpdateRequest>(request, adminPaymentPackageUpdateSchema);
    const { id } = await params;
    const result = await updatePaymentPackage({
      packageId: id,
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminPaymentPackageMutationResponse = {
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
    const result = await deletePaymentPackage({
      packageId: id,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminPaymentPackageMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
