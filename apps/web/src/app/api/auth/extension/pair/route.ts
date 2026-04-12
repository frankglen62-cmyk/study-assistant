import { z } from 'zod';

import type { ExtensionPairingCodeResponse } from '@study-assistant/shared-types';

import { env } from '@/lib/env/server';
import { issuePairingCode, hashOpaqueToken } from '@/lib/auth/extension-tokens';
import { requirePortalUser } from '@/lib/auth/request-context';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { createPairingCode } from '@/lib/supabase/extension';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { getUserAccessOverrideByUserId } from '@/lib/supabase/users';

const requestSchema = z
  .object({
    deviceName: z.string().min(2).max(120).optional(),
  })
  .optional();

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client', 'admin', 'super_admin']);
    assertRateLimit(`pair:${context.userId}`, { max: 10, windowMs: 10 * 60 * 1000 });
    const accessOverride = await getUserAccessOverrideByUserId(context.userId);

    if (accessOverride?.can_use_extension === false) {
      throw new RouteError(403, 'extension_access_disabled', 'Extension access is disabled for this account.');
    }

    const body = await parseJsonBody(request, requestSchema);
    const pairingCode = issuePairingCode();
    const expiresAt = new Date(Date.now() + env.EXTENSION_PAIRING_CODE_TTL_SECONDS * 1000).toISOString();

    await createPairingCode({
      userId: context.userId,
      codeHash: hashOpaqueToken(pairingCode),
      expiresAt,
      createdBy: context.userId,
      metadata: body?.deviceName ? { deviceName: body.deviceName } : {},
    });

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'extension.pairing_code.created',
      entityType: 'extension_pairing_codes',
      eventSummary: 'Generated a short-lived extension pairing code.',
      newValues: {
        expiresAt,
        deviceName: body?.deviceName ?? null,
      },
      ipAddress,
      userAgent,
    });

    const response: ExtensionPairingCodeResponse = {
      pairingCode,
      expiresAt,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
