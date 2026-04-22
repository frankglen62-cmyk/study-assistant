import type { AdminUsersResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_READ } from '@/lib/security/rate-limit';
import { getAdminUsersPageData } from '@/features/admin/server';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-users:${context.userId}`, RL_ADMIN_READ);
    const url = new URL(request.url);
    const result = await getAdminUsersPageData({
      q: url.searchParams.get('q') ?? undefined,
      role: url.searchParams.get('role') ?? undefined,
      filter: url.searchParams.get('filter') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });
    const response: AdminUsersResponse = result;
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
