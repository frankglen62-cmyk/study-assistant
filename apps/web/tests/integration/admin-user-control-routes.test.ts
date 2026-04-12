import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const authMocks = vi.hoisted(() => ({
  requirePortalUser: vi.fn(),
}));

const adminServiceMocks = vi.hoisted(() => ({
  addAdminUserNote: vi.fn(),
  upsertAdminUserAccessOverrides: vi.fn(),
  revokeAdminUserDevices: vi.fn(),
  applyAdminBulkUserAction: vi.fn(),
}));

const securityMocks = vi.hoisted(() => ({
  assertRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth/request-context', () => authMocks);
vi.mock('@/lib/admin/service', () => adminServiceMocks);
vi.mock('@/lib/security/rate-limit', () => securityMocks);

describe('admin user control routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authMocks.requirePortalUser.mockResolvedValue({
      userId: 'admin-1',
      profile: {
        role: 'admin',
        full_name: 'Portal Admin',
        email: 'admin@example.com',
      },
    });
  });

  it('creates an internal admin note for a user', async () => {
    adminServiceMocks.addAdminUserNote.mockResolvedValue({
      noteId: 'note-1',
      message: 'Admin note added successfully.',
    });

    const { POST } = await import('@/app/api/admin/users/[id]/notes/route');
    const response = await POST(
      new Request('http://localhost:3000/api/admin/users/user-1/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: 'Customer requested manual review.',
        }),
      }),
      { params: Promise.resolve({ id: 'user-1' }) },
    );

    const payload = (await response.json()) as { success: boolean; noteId: string };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.noteId).toBe('note-1');
    expect(adminServiceMocks.addAdminUserNote).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        note: 'Customer requested manual review.',
        actorUserId: 'admin-1',
      }),
    );
  });

  it('saves user access overrides from the admin route', async () => {
    adminServiceMocks.upsertAdminUserAccessOverrides.mockResolvedValue({
      userId: 'user-2',
      access: {
        canUseExtension: false,
        canBuyCredits: true,
        maxActiveDevices: 2,
        dailyUsageLimitSeconds: 3600,
        monthlyUsageLimitSeconds: null,
        featureFlags: ['priority_support'],
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
      message: 'Access overrides saved successfully.',
    });

    const { POST } = await import('@/app/api/admin/users/[id]/access/route');
    const response = await POST(
      new Request('http://localhost:3000/api/admin/users/user-2/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canUseExtension: false,
          canBuyCredits: true,
          maxActiveDevices: 2,
          dailyUsageLimitSeconds: 3600,
          monthlyUsageLimitSeconds: null,
          featureFlags: ['priority_support'],
        }),
      }),
      { params: Promise.resolve({ id: 'user-2' }) },
    );

    const payload = (await response.json()) as { success: boolean; access: { canUseExtension: boolean } };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.access.canUseExtension).toBe(false);
    expect(adminServiceMocks.upsertAdminUserAccessOverrides).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        canUseExtension: false,
        featureFlags: ['priority_support'],
      }),
    );
  });

  it('applies a bulk suspend action through the admin route', async () => {
    adminServiceMocks.applyAdminBulkUserAction.mockResolvedValue({
      processed: 2,
      succeeded: 2,
      failures: [],
      message: 'Bulk action completed successfully for 2 users.',
    });

    const { POST } = await import('@/app/api/admin/users/bulk/route');
    const response = await POST(
      new Request('http://localhost:3000/api/admin/users/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: ['70da0630-e057-4d93-a11b-b1df07bba468', '24ab2b65-7afb-496f-91f4-eb7d0a24eec2'],
          action: 'suspend',
          reason: 'Billing hold',
        }),
      }),
    );

    const payload = (await response.json()) as { success: boolean; succeeded: number };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.succeeded).toBe(2);
    expect(adminServiceMocks.applyAdminBulkUserAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'suspend',
        reason: 'Billing hold',
        actorUserId: 'admin-1',
      }),
    );
  });
});
