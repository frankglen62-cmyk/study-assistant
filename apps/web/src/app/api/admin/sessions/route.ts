import type { AdminSessionsResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_READ } from '@/lib/security/rate-limit';
import { getAdminSessionsPageData } from '@/features/admin/server';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-sessions:${context.userId}`, RL_ADMIN_READ);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? undefined;
    const sessions = await getAdminSessionsPageData({ userId });
    const response: AdminSessionsResponse = { sessions };
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
