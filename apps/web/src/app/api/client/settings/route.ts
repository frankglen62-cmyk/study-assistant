import type { ClientSettingsResponse, ClientSettingsUpdateRequest } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_READ, RL_CLIENT_MUTATE } from '@/lib/security/rate-limit';
import { writeAuditLog } from '@/lib/observability/audit';
import { getClientSettingsByUserId, updateClientSettingsByUserId } from '@/lib/supabase/client-settings';
import { clientSettingsSchema } from '@/features/client/settings';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client']);
    assertRateLimit(`client-settings:${context.userId}`, RL_CLIENT_READ);
    const settings = await getClientSettingsByUserId(context.userId);
    const response: ClientSettingsResponse = {
      settings,
    };
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PUT(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client']);
    assertRateLimit(`client-settings-update:${context.userId}`, RL_CLIENT_MUTATE);
    const body = await parseJsonBody<ClientSettingsUpdateRequest>(request, clientSettingsSchema);
    const previousSettings = await getClientSettingsByUserId(context.userId);
    const settings = await updateClientSettingsByUserId(context.userId, body);

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'client.settings.updated',
      entityType: 'client_settings',
      entityId: context.userId,
      eventSummary: 'Updated client portal settings.',
      oldValues: previousSettings as unknown as Record<string, unknown>,
      newValues: settings as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    });

    const response: ClientSettingsResponse = {
      settings,
    };
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
