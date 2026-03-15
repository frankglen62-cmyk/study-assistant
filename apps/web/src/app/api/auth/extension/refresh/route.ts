import { z } from 'zod';

import type { ExtensionRefreshTokenResponse } from '@study-assistant/shared-types';

import { createExtensionAccessToken, hashOpaqueToken, issueRefreshToken } from '@/lib/auth/extension-tokens';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getInstallationById, getRefreshTokenRecord, revokeRefreshToken, storeRefreshToken } from '@/lib/supabase/extension';
import { assertRateLimit } from '@/lib/security/rate-limit';

const requestSchema = z.object({
  installationId: z.string().uuid(),
  refreshToken: z.string().min(20),
});

export async function POST(request: Request) {
  const { requestId, ipAddress } = getRequestMeta(request);

  try {
    assertRateLimit(`refresh:${ipAddress ?? 'unknown'}`, { max: 30, windowMs: 10 * 60 * 1000 });
    const body = await parseJsonBody(request, requestSchema);
    const tokenRecord = await getRefreshTokenRecord(body.installationId, hashOpaqueToken(body.refreshToken));
    const installation = await getInstallationById(body.installationId);

    if (installation.installation_status !== 'active') {
      await revokeRefreshToken(tokenRecord.id);
      throw new RouteError(401, 'installation_revoked', 'This extension installation has been revoked.');
    }

    const nextRefreshToken = issueRefreshToken();
    await storeRefreshToken({
      installationId: installation.id,
      tokenHash: nextRefreshToken.tokenHash,
      expiresAt: nextRefreshToken.expiresAt,
    });
    await revokeRefreshToken(tokenRecord.id);

    const response: ExtensionRefreshTokenResponse = {
      accessToken: createExtensionAccessToken({
        installationId: installation.id,
        userId: installation.user_id,
      }),
      refreshToken: nextRefreshToken.token,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
