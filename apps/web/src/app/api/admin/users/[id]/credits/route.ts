import type { AdminUserCreditAdjustmentRequest, AdminUserCreditAdjustmentResponse } from '@study-assistant/shared-types';

import { adjustUserCredits } from '@/lib/admin/service';
import { adminUserCreditAdjustmentSchema } from '@/lib/admin/schemas';
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
    const body = await parseJsonBody<AdminUserCreditAdjustmentRequest>(request, adminUserCreditAdjustmentSchema);
    assertRateLimit(`admin-user-credits:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    const result = await adjustUserCredits({
      userId: id,
      deltaSeconds: body.deltaSeconds,
      description: body.description,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminUserCreditAdjustmentResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
