import type { AdminUserAccessOverrideResponse } from '@study-assistant/shared-types';

import { adminUserAccessOverrideSchema } from '@/lib/admin/schemas';
import { upsertAdminUserAccessOverrides } from '@/lib/admin/service';
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
    const body = await parseJsonBody(request, adminUserAccessOverrideSchema);
    assertRateLimit(`admin-user-access:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    const result = await upsertAdminUserAccessOverrides({
      userId: id,
      canUseExtension: body.canUseExtension,
      canBuyCredits: body.canBuyCredits,
      maxActiveDevices: body.maxActiveDevices ?? null,
      dailyUsageLimitSeconds: body.dailyUsageLimitSeconds ?? null,
      monthlyUsageLimitSeconds: body.monthlyUsageLimitSeconds ?? null,
      featureFlags: body.featureFlags ?? [],
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminUserAccessOverrideResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
