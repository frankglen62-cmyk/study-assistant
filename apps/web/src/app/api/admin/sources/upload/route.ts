import type { AdminSourceUploadResponse } from '@study-assistant/shared-types';

import { adminSourceUploadPayloadSchema, parseDelimitedTextList } from '@/lib/admin/schemas';
import { uploadSource } from '@/lib/admin/service';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, RouteError } from '@/lib/http/route';
import { assertRateLimit, RL_ADMIN_MUTATE } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-source-upload:${context.userId}`, RL_ADMIN_MUTATE);
    const formData = await request.formData();
    const rawFile = formData.get('file');

    if (!(rawFile instanceof File)) {
      throw new RouteError(400, 'file_required', 'A source file is required.');
    }

    const parsedPayload = adminSourceUploadPayloadSchema.safeParse({
      title: formData.get('title'),
      subjectId: formData.get('subjectId'),
      folderId: formData.get('folderId'),
      categoryId: formData.get('categoryId') || null,
      description: formData.get('description'),
      tags: parseDelimitedTextList(formData.get('tags')?.toString()),
      sourcePriority: Number.parseInt(formData.get('sourcePriority')?.toString() ?? '0', 10),
      activateOnSuccess: ['on', 'true', '1'].includes(formData.get('activateOnSuccess')?.toString() ?? ''),
    });

    if (!parsedPayload.success) {
      throw new RouteError(400, 'invalid_request', 'Upload form validation failed.', parsedPayload.error.flatten());
    }

    const result = await uploadSource({
      ...parsedPayload.data,
      file: rawFile,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    const response: AdminSourceUploadResponse = {
      success: true,
      ...result,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
