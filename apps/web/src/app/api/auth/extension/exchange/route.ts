import { z } from 'zod';

import type { ExtensionPairingExchangeResponse } from '@study-assistant/shared-types';

import { createExtensionAccessToken, hashOpaqueToken, issueRefreshToken } from '@/lib/auth/extension-tokens';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { assertMaintenanceAccess } from '@/lib/platform/system-settings';
import { getOpenSessionForUser } from '@/lib/supabase/sessions';
import { getProfileWithWalletByUserId, getUserAccessOverrideByUserId } from '@/lib/supabase/users';
import {
  assignPairingCodeInstallation,
  consumePairingCode,
  createInstallation,
  revokeAllInstallationsForUser,
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
    const account = await getProfileWithWalletByUserId(pairing.user_id);
    const accessOverride = await getUserAccessOverrideByUserId(pairing.user_id);
    await assertMaintenanceAccess({
      role: account.profile.role,
      target: 'extension',
    });

    if (accessOverride?.can_use_extension === false) {
      throw new RouteError(403, 'extension_access_disabled', 'Extension access is disabled for this account.');
    }

    // ── Session-based security ───────────────────────────────────────
    // If the account owner has an active session that is bound to a
    // different installation, block pairing — someone else might be
    // trying to hijack the account while the owner is online.
    const openSession = await getOpenSessionForUser(pairing.user_id);

    if (
      openSession &&
      openSession.extension_installation_id &&
      openSession.status === 'active'
    ) {
      throw new RouteError(
        409,
        'session_active_on_device',
        'This account has an active session running on another device. End the session first before pairing a new device.',
      );
    }

    // ── Clean slate pairing ──────────────────────────────────────────
    // Revoke ALL previous installations so only 1 device is ever active.
    // This prevents duplicate accumulation and ensures clean re-pairing.
    await revokeAllInstallationsForUser(pairing.user_id);

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
      remainingSeconds: account.wallet.remaining_seconds,
      sessionStatus: openSession ? toExtensionSessionStatus(openSession.status) : 'session_inactive',
      userEmail: account.profile.email,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
