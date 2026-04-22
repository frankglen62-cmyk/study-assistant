import type { ClientDevicesResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_READ } from '@/lib/security/rate-limit';
import { listInstallationsForUser } from '@/lib/supabase/extension';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client']);
    assertRateLimit(`client-devices:${context.userId}`, RL_CLIENT_READ);
    const devices = await listInstallationsForUser(context.userId);

    const response: ClientDevicesResponse = {
      devices: devices.map((device) => ({
        id: device.id,
        installationStatus: device.installation_status,
        deviceName: device.device_name ?? null,
        browserName: device.browser_name ?? null,
        extensionVersion: device.extension_version,
        lastSeenAt: device.last_seen_at,
      })),
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
