import { z } from 'zod';

import type { ExtensionRefreshTokenResponse } from '@study-assistant/shared-types';

import { createExtensionAccessToken, hashOpaqueToken, issueRefreshToken } from '@/lib/auth/extension-tokens';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { assertMaintenanceAccess } from '@/lib/platform/system-settings';
import { getInstallationById, rotateExtensionRefreshToken } from '@/lib/supabase/extension';
import { getProfileByUserId } from '@/lib/supabase/users';
import { assertDistributedRateLimit } from '@/lib/security/rate-limit';

const requestSchema = z.object({
  installationId: z.string().uuid(),
  refreshToken: z.string().min(20),
});

export async function POST(request: Request) {
  const { requestId, ipAddress } = getRequestMeta(request);

  try {
    await assertDistributedRateLimit(`refresh:${ipAddress ?? 'unknown'}`, { max: 30, windowMs: 10 * 60 * 1000 });
    const body = await parseJsonBody(request, requestSchema);
    const installation = await getInstallationById(body.installationId);
    const profile = await getProfileByUserId(installation.user_id);
    await assertMaintenanceAccess({
      role: profile.role,
      target: 'extension',
    });

    const nextRefreshToken = issueRefreshToken();
    const rotatedUserId = await rotateExtensionRefreshToken({
      installationId: installation.id,
      currentTokenHash: hashOpaqueToken(body.refreshToken),
      nextTokenHash: nextRefreshToken.tokenHash,
      nextExpiresAt: nextRefreshToken.expiresAt,
    });

    const response: ExtensionRefreshTokenResponse = {
      accessToken: createExtensionAccessToken({
        installationId: installation.id,
        userId: rotatedUserId,
      }),
      refreshToken: nextRefreshToken.token,
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
