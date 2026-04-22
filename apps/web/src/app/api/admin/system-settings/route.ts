import { adminSystemSettingsUpdateSchema } from '@/lib/admin/schemas';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { updateSystemSettings } from '@/lib/platform/system-settings';
import { systemSettingsSchema } from '@/lib/platform/system-settings-schema';
import { assertRateLimit, RL_ADMIN_MUTATE } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-system-settings:${context.userId}`, RL_ADMIN_MUTATE);
    const settings = systemSettingsSchema.parse(
      await parseJsonBody(request, adminSystemSettingsUpdateSchema),
    );
    const saved = await updateSystemSettings({
      settings,
      actorUserId: context.userId,
      actorRole: context.profile.role,
      ipAddress,
      userAgent,
    });

    return jsonOk(
      {
        success: true,
        message: `Platform settings updated for ${saved.platformName}.`,
        settings: saved,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
