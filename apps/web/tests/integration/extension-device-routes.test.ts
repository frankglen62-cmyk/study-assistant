import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const authMocks = vi.hoisted(() => ({
  requirePortalUser: vi.fn(),
  requireClientUser: vi.fn(),
}));

const extensionMocks = vi.hoisted(() => ({
  createPairingCode: vi.fn(),
  revokeInstallation: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  getUserAccessOverrideByUserId: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
}));

const securityMocks = vi.hoisted(() => ({
  assertRateLimit: vi.fn(),
}));

const tokenMocks = vi.hoisted(() => ({
  issuePairingCode: vi.fn(),
  hashOpaqueToken: vi.fn(),
}));

vi.mock('@/lib/auth/request-context', () => authMocks);
vi.mock('@/lib/supabase/extension', () => extensionMocks);
vi.mock('@/lib/supabase/users', () => userMocks);
vi.mock('@/lib/observability/audit', () => auditMocks);
vi.mock('@/lib/security/rate-limit', () => securityMocks);
vi.mock('@/lib/auth/extension-tokens', () => tokenMocks);

describe('extension device routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authMocks.requirePortalUser.mockResolvedValue({
      userId: 'client-1',
      profile: {
        role: 'client',
        full_name: 'Client User',
        email: 'client@example.com',
      },
      wallet: {
        status: 'active',
        remaining_seconds: 3600,
      },
    });
    authMocks.requireClientUser.mockResolvedValue({
      userId: 'client-1',
      profile: {
        role: 'client',
        full_name: 'Client User',
        email: 'client@example.com',
      },
    });
    tokenMocks.issuePairingCode.mockReturnValue('PAIR1234');
    tokenMocks.hashOpaqueToken.mockReturnValue('hashed-pairing-code');
    extensionMocks.createPairingCode.mockResolvedValue({ id: 'pairing-1' });
    userMocks.getUserAccessOverrideByUserId.mockResolvedValue(null);
  });

  it('issues a short-lived pairing code for the client portal', async () => {
    const { POST } = await import('@/app/api/auth/extension/pair/route');

    const response = await POST(
      new Request('http://localhost:3000/api/auth/extension/pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceName: 'Library Laptop',
        }),
      }),
    );

    const payload = (await response.json()) as { pairingCode: string; expiresAt: string };

    expect(response.status).toBe(200);
    expect(payload.pairingCode).toBe('PAIR1234');
    expect(extensionMocks.createPairingCode).toHaveBeenCalledOnce();
    expect(auditMocks.writeAuditLog).toHaveBeenCalledOnce();
  });

  it('revokes a paired installation from the client devices route', async () => {
    const { POST } = await import('@/app/api/client/devices/revoke/route');

    const response = await POST(
      new Request('http://localhost:3000/api/client/devices/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          installationId: '8aab9d86-7c0a-4482-b210-47cfaf495f9b',
        }),
      }),
    );

    const payload = (await response.json()) as { revoked: boolean };

    expect(response.status).toBe(200);
    expect(payload.revoked).toBe(true);
    expect(extensionMocks.revokeInstallation).toHaveBeenCalledOnce();
    expect(auditMocks.writeAuditLog).toHaveBeenCalledOnce();
  });
});
