import type { UserRole } from '@study-assistant/shared-types';
import type { User } from '@supabase/supabase-js';

import { EMAIL_LOGIN_SESSION_COOKIE, verifySignedEmailLoginSessionToken } from '@/lib/auth/email-challenge';
import { RouteError, getBearerToken } from '@/lib/http/route';
import { logEvent } from '@/lib/observability/logger';
import { assertMaintenanceAccess } from '@/lib/platform/system-settings';
import { getInstallationById, touchInstallation } from '@/lib/supabase/extension';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { getProfileWithWalletByUserId, getUserAccessOverrideByUserId } from '@/lib/supabase/users';
import { getSupabaseAdmin } from '@/lib/supabase/server';

import { verifyExtensionAccessToken } from './extension-tokens';

interface BaseContext {
  userId: string;
  profile: Awaited<ReturnType<typeof getProfileWithWalletByUserId>>['profile'];
  wallet: Awaited<ReturnType<typeof getProfileWithWalletByUserId>>['wallet'];
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function getJwtAssuranceLevel(token: string | null) {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { aal?: unknown };
    return parsed.aal === 'aal2' || parsed.aal === 'aal1' ? parsed.aal : null;
  } catch {
    return null;
  }
}

async function assertPortalAssurance(params: {
  request: Request;
  user: User;
  profile: Awaited<ReturnType<typeof getProfileWithWalletByUserId>>['profile'];
  assuranceLevel: 'aal1' | 'aal2' | null;
}) {
  const hasVerifiedMfaFactor = (params.user.factors ?? []).some((factor) => factor.status === 'verified');
  if (hasVerifiedMfaFactor && params.assuranceLevel !== 'aal2') {
    throw new RouteError(403, 'mfa_required', 'Complete multi-factor authentication before using protected APIs.');
  }

  const authEmailSetting = params.user.user_metadata?.email_2fa_enabled;
  const emailApprovalRequired =
    typeof authEmailSetting === 'boolean' ? authEmailSetting : params.profile.email_2fa_enabled === true;

  if (!emailApprovalRequired) return;

  const rawApproval = readCookie(params.request, EMAIL_LOGIN_SESSION_COOKIE);
  const approval = rawApproval ? await verifySignedEmailLoginSessionToken(rawApproval) : null;
  const approved =
    approval?.userId === params.user.id &&
    approval.signInAt === (params.user.last_sign_in_at ?? '');

  if (!approved) {
    throw new RouteError(403, 'email_approval_required', 'Complete email approval before using protected APIs.');
  }
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
  let authUser: User;
  let assuranceLevel: 'aal1' | 'aal2' | null = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = getBearerToken(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new RouteError(401, 'invalid_auth_token', 'Authentication token is invalid.');
    }

    userId = data.user.id;
    authUser = data.user;
    assuranceLevel = getJwtAssuranceLevel(token);
  } else {
    const supabase = await getSupabaseServerSessionClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new RouteError(401, 'invalid_auth_token', 'Authentication token is invalid.');
    }

    userId = data.user.id;
    authUser = data.user;
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!assurance.error) {
      assuranceLevel = assurance.data.currentLevel;
    }
  }

  const context = await getProfileWithWalletByUserId(userId);
  assertActiveProfile(context.profile, allowedRoles);
  await assertPortalAssurance({ request, user: authUser, profile: context.profile, assuranceLevel });
  await assertMaintenanceAccess({
    role: context.profile.role,
    target: 'portal_api',
  });
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

  const [context, accessOverride] = await Promise.all([
    getProfileWithWalletByUserId(payload.userId),
    getUserAccessOverrideByUserId(payload.userId),
  ]);
  assertActiveProfile(context.profile, ['client', 'admin', 'super_admin']);

  if (accessOverride?.can_use_extension === false) {
    throw new RouteError(403, 'extension_access_disabled', 'Extension access is disabled for this account.');
  }
  await assertMaintenanceAccess({
    role: context.profile.role,
    target: 'extension',
  });

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
