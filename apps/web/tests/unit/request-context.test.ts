import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const authMocks = vi.hoisted(() => ({
  verifySignedEmailLoginSessionToken: vi.fn(),
  getUser: vi.fn(),
}));

const dependencyMocks = vi.hoisted(() => ({
  assertMaintenanceAccess: vi.fn(),
  getProfileWithWalletByUserId: vi.fn(),
}));

vi.mock('@/lib/auth/email-challenge', () => ({
  EMAIL_LOGIN_SESSION_COOKIE: 'study_email_approved',
  verifySignedEmailLoginSessionToken: authMocks.verifySignedEmailLoginSessionToken,
}));
vi.mock('@/lib/platform/system-settings', () => ({
  assertMaintenanceAccess: dependencyMocks.assertMaintenanceAccess,
}));
vi.mock('@/lib/supabase/users', () => ({
  getProfileWithWalletByUserId: dependencyMocks.getProfileWithWalletByUserId,
  getUserAccessOverrideByUserId: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: authMocks.getUser } }),
}));
vi.mock('@/lib/supabase/server-session', () => ({
  getSupabaseServerSessionClient: vi.fn(),
}));
vi.mock('@/lib/supabase/extension', () => ({
  getInstallationById: vi.fn(),
  touchInstallation: vi.fn(),
}));
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }));
vi.mock('@/lib/auth/extension-tokens', () => ({ verifyExtensionAccessToken: vi.fn() }));

function makeAccessToken(aal: 'aal1' | 'aal2') {
  const payload = Buffer.from(JSON.stringify({ aal })).toString('base64url');
  return `header.${payload}.signature`;
}

function makeAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    factors: [],
    user_metadata: { email_2fa_enabled: false },
    last_sign_in_at: '2026-07-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('portal API assurance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencyMocks.getProfileWithWalletByUserId.mockResolvedValue({
      profile: {
        id: 'user-1',
        role: 'client',
        account_status: 'active',
        email_2fa_enabled: false,
      },
      wallet: {
        id: 'wallet-1',
        user_id: 'user-1',
        remaining_seconds: 3600,
        lifetime_seconds_purchased: 3600,
        lifetime_seconds_used: 0,
        status: 'active',
      },
    });
  });

  it('rejects an AAL1 bearer token when the user has a verified MFA factor', async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: makeAuthUser({ factors: [{ id: 'factor-1', status: 'verified' }] }) },
      error: null,
    });

    const { requirePortalUser } = await import('@/lib/auth/request-context');
    const request = new Request('https://app.example.com/api/client/wallet', {
      headers: { authorization: `Bearer ${makeAccessToken('aal1')}` },
    });

    await expect(requirePortalUser(request)).rejects.toMatchObject({
      status: 403,
      code: 'mfa_required',
    });
  });

  it('rejects protected API access without the signed email approval cookie', async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: makeAuthUser({ user_metadata: { email_2fa_enabled: true } }) },
      error: null,
    });

    const { requirePortalUser } = await import('@/lib/auth/request-context');
    const request = new Request('https://app.example.com/api/client/wallet', {
      headers: { authorization: `Bearer ${makeAccessToken('aal1')}` },
    });

    await expect(requirePortalUser(request)).rejects.toMatchObject({
      status: 403,
      code: 'email_approval_required',
    });
  });

  it('accepts AAL2 plus a signed approval tied to the current sign-in', async () => {
    authMocks.getUser.mockResolvedValue({
      data: {
        user: makeAuthUser({
          factors: [{ id: 'factor-1', status: 'verified' }],
          user_metadata: { email_2fa_enabled: true },
        }),
      },
      error: null,
    });
    authMocks.verifySignedEmailLoginSessionToken.mockResolvedValue({
      userId: 'user-1',
      signInAt: '2026-07-14T12:00:00.000Z',
    });

    const { requirePortalUser } = await import('@/lib/auth/request-context');
    const request = new Request('https://app.example.com/api/client/wallet', {
      headers: {
        authorization: `Bearer ${makeAccessToken('aal2')}`,
        cookie: 'study_email_approved=signed-token',
      },
    });

    await expect(requirePortalUser(request)).resolves.toMatchObject({ userId: 'user-1' });
    expect(dependencyMocks.assertMaintenanceAccess).toHaveBeenCalledWith({
      role: 'client',
      target: 'portal_api',
    });
  });
});
