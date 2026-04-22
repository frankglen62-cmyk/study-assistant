import type { AdminReportsResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_READ } from '@/lib/security/rate-limit';
import { getAdminReportsPageData } from '@/features/admin/server';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-reports:${context.userId}`, RL_ADMIN_READ);
    const reports = await getAdminReportsPageData();
    const response: AdminReportsResponse = reports;
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
