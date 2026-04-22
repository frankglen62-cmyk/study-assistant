import type { AdminPaymentPackageCreateRequest, AdminPaymentPackageMutationResponse } from '@study-assistant/shared-types';
import { revalidatePath } from 'next/cache';

import { adminPaymentPackageCreateSchema } from '@/lib/admin/schemas';
import { createPaymentPackage } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_MUTATE } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-payment-package:${context.userId}`, RL_ADMIN_MUTATE);
    const body = await parseJsonBody<AdminPaymentPackageCreateRequest>(request, adminPaymentPackageCreateSchema);
    const result = await createPaymentPackage({
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

    revalidatePath('/pricing');
    revalidatePath('/buy-credits');

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
