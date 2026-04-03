import type { UserRole } from '@study-assistant/shared-types';

import { RouteError, getBearerToken } from '@/lib/http/route';
import { logEvent } from '@/lib/observability/logger';
import { getInstallationById, touchInstallation } from '@/lib/supabase/extension';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { getProfileWithWalletByUserId } from '@/lib/supabase/users';
import { getSupabaseAdmin } from '@/lib/supabase/server';

import { verifyExtensionAccessToken } from './extension-tokens';

interface BaseContext {
  userId: string;
  profile: Awaited<ReturnType<typeof getProfileWithWalletByUserId>>['profile'];
  wallet: Awaited<ReturnType<typeof getProfileWithWalletByUserId>>['wallet'];
}

export interface PortalClientContext extends BaseContext {}

export interface ExtensionClientContext extends BaseContext {
  installationId: string;
}

function assertActiveProfile(
  profile: Awaited<ReturnType<typeof getProfileWithWalletByUserId>>['profile'],
  allowedRoles: UserRole[],
) {
  if (!allowedRoles.includes(profile.role)) {
    throw new RouteError(403, 'insufficient_role', 'This action is not permitted for the current role.');
  }

  if (profile.account_status !== 'active') {
    throw new RouteError(403, 'account_inactive', 'The account must be active to continue.');
  }
}

export async function requirePortalUser(request: Request, allowedRoles: UserRole[] = ['client']): Promise<PortalClientContext> {
  const authorization = request.headers.get('authorization');
  let userId: string;

  if (authorization?.startsWith('Bearer ')) {
    const token = getBearerToken(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new RouteError(401, 'invalid_auth_token', 'Authentication token is invalid.');
    }

    userId = data.user.id;
  } else {
    const supabase = await getSupabaseServerSessionClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new RouteError(401, 'invalid_auth_token', 'Authentication token is invalid.');
    }

    userId = data.user.id;
  }

  const context = await getProfileWithWalletByUserId(userId);
  assertActiveProfile(context.profile, allowedRoles);
  return {
    userId,
    profile: context.profile,
    wallet: context.wallet,
  };
}

export async function requireExtensionUser(request: Request): Promise<ExtensionClientContext> {
  const token = getBearerToken(request);
  const payload = verifyExtensionAccessToken(token);
  const installation = await getInstallationById(payload.installationId);
  const requestExtensionVersion = request.headers.get('x-extension-version');

  if (installation.user_id !== payload.userId) {
    throw new RouteError(401, 'installation_user_mismatch', 'Extension installation is invalid.');
  }

  if (installation.installation_status !== 'active') {
    throw new RouteError(401, 'installation_revoked', 'This extension installation has been revoked.');
  }

  const context = await getProfileWithWalletByUserId(payload.userId);
  assertActiveProfile(context.profile, ['client', 'admin', 'super_admin']);

  await touchInstallation(installation.id, requestExtensionVersion);

  logEvent('info', 'extension.authenticated', {
    installationId: installation.id,
    userId: payload.userId,
  });

  return {
    userId: payload.userId,
    installationId: installation.id,
    profile: context.profile,
    wallet: context.wallet,
  };
}

export async function requireClientUser(request: Request): Promise<PortalClientContext | ExtensionClientContext> {
  try {
    return await requireExtensionUser(request);
  } catch (error) {
    if (!(error instanceof RouteError)) {
      throw error;
    }

    if (
      (error as any).code !== 'missing_bearer_token' &&
      (error as any).code !== 'invalid_extension_token' &&
      (error as any).code !== 'extension_token_expired' &&
      (error as any).code !== 'installation_user_mismatch'
    ) {
      throw error;
    }

    return requirePortalUser(request, ['client', 'admin', 'super_admin']);
  }
}
