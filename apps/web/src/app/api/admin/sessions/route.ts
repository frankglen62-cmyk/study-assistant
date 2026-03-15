import type { AdminSessionsResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { getAdminSessionsPageData } from '@/features/admin/server';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    await requirePortalUser(request, ['admin', 'super_admin']);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? undefined;
    const sessions = await getAdminSessionsPageData({ userId });
    const response: AdminSessionsResponse = { sessions };
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
