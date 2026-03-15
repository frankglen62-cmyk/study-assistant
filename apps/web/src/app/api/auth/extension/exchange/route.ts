import { z } from 'zod';

import type { ExtensionPairingExchangeResponse } from '@study-assistant/shared-types';

import { createExtensionAccessToken, hashOpaqueToken, issueRefreshToken } from '@/lib/auth/extension-tokens';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { getOpenSessionForUser } from '@/lib/supabase/sessions';
import { getWalletByUserId } from '@/lib/supabase/users';
import {
  assignPairingCodeInstallation,
  consumePairingCode,
  createInstallation,
  storeRefreshToken,
} from '@/lib/supabase/extension';
import { toExtensionSessionStatus } from '@/lib/sessions/mapping';
import { assertRateLimit } from '@/lib/security/rate-limit';

const requestSchema = z.object({
  pairingCode: z.string().min(6).max(16),
  deviceName: z.string().min(2).max(120),
  browserName: z.string().min(2).max(120),
  extensionVersion: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    assertRateLimit(`exchange:${ipAddress ?? 'unknown'}`, { max: 20, windowMs: 10 * 60 * 1000 });
    const body = await parseJsonBody(request, requestSchema);
    const pairing = await consumePairingCode(hashOpaqueToken(body.pairingCode.trim().toUpperCase()));
    const installation = await createInstallation({
      userId: pairing.user_id,
      deviceName: body.deviceName,
      browserName: body.browserName,
      extensionVersion: body.extensionVersion,
    });

    await assignPairingCodeInstallation(pairing.id, installation.id);

    const refreshToken = issueRefreshToken();
    await storeRefreshToken({
      installationId: installation.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
    });

    const wallet = await getWalletByUserId(pairing.user_id);
    const openSession = await getOpenSessionForUser(pairing.user_id);

    await writeAuditLog({
      actorUserId: pairing.user_id,
      actorRole: 'client',
      eventType: 'extension.installation.paired',
      entityType: 'extension_installations',
      entityId: installation.id,
      eventSummary: `Paired extension installation ${installation.id}.`,
      newValues: {
        browserName: body.browserName,
        extensionVersion: body.extensionVersion,
        deviceName: body.deviceName,
      },
      ipAddress,
      userAgent,
    });

    const response: ExtensionPairingExchangeResponse = {
      installationId: installation.id,
      accessToken: createExtensionAccessToken({
        installationId: installation.id,
        userId: pairing.user_id,
      }),
      refreshToken: refreshToken.token,
      remainingSeconds: wallet.remaining_seconds,
      sessionStatus: openSession ? toExtensionSessionStatus(openSession.status) : 'session_inactive',
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
