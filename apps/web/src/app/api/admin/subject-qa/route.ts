import type {
  AdminSubjectQaPairListResponse,
  AdminSubjectQaPairCreateRequest,
  AdminSubjectQaPairMutationResponse,
} from '@study-assistant/shared-types';

import { adminSubjectQaPairCreateSchema } from '@/lib/admin/schemas';
import { createSubjectQaPair } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_READ, RL_ADMIN_MUTATE } from '@/lib/security/rate-limit';
import { listAdminSubjectQaPairsBySubjectId } from '@/lib/supabase/subject-qa';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function mapPairToSummary(pair: Awaited<ReturnType<typeof listAdminSubjectQaPairsBySubjectId>>[number]) {
  return {
    id: pair.id,
    subjectId: pair.subject_id,
    categoryId: pair.category_id,
    questionText: pair.question_text,
    answerText: pair.answer_text,
    shortExplanation: pair.short_explanation ?? null,
    keywords: pair.keywords,
    isActive: pair.is_active,
    sortOrder: pair.sort_order,
    updatedAt: pair.updated_at,
    subjectName: pair.subjects?.name ?? null,
    categoryName: pair.categories?.name ?? null,
    questionType: pair.question_type ?? 'multiple_choice',
    questionImageUrl: pair.question_image_url ?? null,
  };
}

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-qa-read:${context.userId}`, RL_ADMIN_READ);
    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId');

    if (!subjectId) {
      return jsonOk<AdminSubjectQaPairListResponse>({ pairs: [] }, requestId);
    }

    const pairs = await listAdminSubjectQaPairsBySubjectId(subjectId);
    return jsonOk<AdminSubjectQaPairListResponse>(
      {
        pairs: pairs.map(mapPairToSummary),
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-qa-mutate:${context.userId}`, RL_ADMIN_MUTATE);
    const body = await parseJsonBody<AdminSubjectQaPairCreateRequest>(request, adminSubjectQaPairCreateSchema);
    const result = await createSubjectQaPair({
      ...body,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminSubjectQaPairMutationResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
