import type {
  AdminSubjectQaPairCreateRequest,
} from '@study-assistant/shared-types';

import { adminSubjectQaPairCreateSchema } from '@/lib/admin/schemas';
import { createSubjectQaPairFast } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface BatchCreateRequest {
  pairs: AdminSubjectQaPairCreateRequest[];
}

interface BatchCreateResponse {
  success: boolean;
  message: string;
  savedCount: number;
  failedCount: number;
  pairIds: string[];
  errors: string[];
}

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const body = (await request.json()) as BatchCreateRequest;

    if (!body.pairs || !Array.isArray(body.pairs) || body.pairs.length === 0) {
      return jsonOk<BatchCreateResponse>(
        {
          success: false,
          message: 'No pairs provided.',
          savedCount: 0,
          failedCount: 0,
          pairIds: [],
          errors: ['Request body must include a non-empty "pairs" array.'],
        },
        requestId,
      );
    }

    if (body.pairs.length > 100) {
      return jsonOk<BatchCreateResponse>(
        {
          success: false,
          message: 'Too many pairs. Maximum is 100 per batch.',
          savedCount: 0,
          failedCount: 0,
          pairIds: [],
          errors: ['Batch limit is 100 pairs per request.'],
        },
        requestId,
      );
    }

    const pairIds: string[] = [];
    const errors: string[] = [];
    let savedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < body.pairs.length; i++) {
      try {
        const parsed = adminSubjectQaPairCreateSchema.parse(body.pairs[i]);
        const result = await createSubjectQaPairFast({
          ...parsed,
          actorUserId: context.userId,
          actorRole: context.profile.role,
          ipAddress,
          userAgent,
        });
        pairIds.push(result.pairId);
        savedCount++;
      } catch (error) {
        failedCount++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Pair ${i + 1}: ${msg}`);
      }
    }

    return jsonOk<BatchCreateResponse>(
      {
        success: failedCount === 0,
        message: `${savedCount} pair${savedCount === 1 ? '' : 's'} saved${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
        savedCount,
        failedCount,
        pairIds,
        errors,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
