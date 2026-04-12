import type { AdminUserDetailResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { getAdminUserDetailData } from '@/features/admin/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId } = getRequestMeta(request);

  try {
    await requirePortalUser(request, ['admin', 'super_admin']);
    const { id } = await params;
    const detail = await getAdminUserDetailData(id);
    const response: AdminUserDetailResponse = detail;
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
