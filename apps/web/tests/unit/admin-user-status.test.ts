import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const userMocks = vi.hoisted(() => ({
  getProfileWithWalletByUserId: vi.fn(),
  setUserAccountStatusAtomic: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  updateOpenSessionsStatusForUser: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));

  return {
    getSupabaseAdmin: vi.fn(() => ({ from })),
    from,
    update,
    eq,
  };
});

vi.mock('@/lib/supabase/users', () => userMocks);
vi.mock('@/lib/supabase/sessions', () => sessionMocks);
vi.mock('@/lib/observability/audit', () => auditMocks);
vi.mock('@/lib/supabase/server', () => supabaseMocks);

describe('admin user status flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.eq.mockResolvedValue({ error: null });
  });

  it('restores a banned client back to active status', async () => {
    userMocks.getProfileWithWalletByUserId.mockResolvedValue({
      profile: {
        id: 'user-1',
        email: 'client@example.com',
        full_name: 'Client One',
        role: 'client',
        account_status: 'banned',
        email_2fa_enabled: false,
      },
      wallet: {
        id: 'wallet-1',
        user_id: 'user-1',
        remaining_seconds: 900,
        lifetime_seconds_purchased: 3600,
        lifetime_seconds_used: 2700,
        status: 'locked',
      },
    });
    userMocks.setUserAccountStatusAtomic.mockResolvedValue({
      user_id: 'user-1',
      account_status: 'active',
      wallet_status: 'active',
    });

    const { updateUserStatus } = await import('@/lib/admin/service');
    const result = await updateUserStatus({
      userId: 'user-1',
      status: 'active',
      reason: 'Appeal approved',
      actorUserId: 'admin-1',
      actorRole: 'admin',
    });

    expect(result.accountStatus).toBe('active');
    expect(userMocks.setUserAccountStatusAtomic).toHaveBeenCalledWith({
      userId: 'user-1',
      accountStatus: 'active',
      walletStatus: 'active',
    });
    expect(supabaseMocks.from).toHaveBeenCalledWith('profiles');
    expect(sessionMocks.updateOpenSessionsStatusForUser).not.toHaveBeenCalled();
  });

  it('ends live sessions and records the moderation reason when banning a user', async () => {
    userMocks.getProfileWithWalletByUserId.mockResolvedValue({
      profile: {
        id: 'user-2',
        email: 'flagged@example.com',
        full_name: 'Flagged User',
        role: 'client',
        account_status: 'active',
        email_2fa_enabled: false,
      },
      wallet: {
        id: 'wallet-2',
        user_id: 'user-2',
        remaining_seconds: 1800,
        lifetime_seconds_purchased: 7200,
        lifetime_seconds_used: 5400,
        status: 'active',
      },
    });
    userMocks.setUserAccountStatusAtomic.mockResolvedValue({
      user_id: 'user-2',
      account_status: 'banned',
      wallet_status: 'locked',
    });
    sessionMocks.updateOpenSessionsStatusForUser.mockResolvedValue({
      count: 2,
      sessions: [],
    });

    const { updateUserStatus } = await import('@/lib/admin/service');
    const result = await updateUserStatus({
      userId: 'user-2',
      status: 'banned',
      reason: 'Fraudulent payment activity',
      actorUserId: 'admin-1',
      actorRole: 'admin',
    });

    expect(result.walletStatus).toBe('locked');
    expect(sessionMocks.updateOpenSessionsStatusForUser).toHaveBeenCalledWith({
      userId: 'user-2',
      status: 'ended',
    });
    expect(auditMocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'user-2',
        newValues: expect.objectContaining({
          accountStatus: 'banned',
          reason: 'Fraudulent payment activity',
          openSessionsClosed: 2,
        }),
      }),
    );
  });

  it('persists suspended-until metadata when suspending a user', async () => {
    const suspendedUntil = '2026-04-20T12:00:00.000Z';

    userMocks.getProfileWithWalletByUserId.mockResolvedValue({
      profile: {
        id: 'user-3',
        email: 'pause@example.com',
        full_name: 'Pause User',
        role: 'client',
        account_status: 'active',
        email_2fa_enabled: false,
        suspended_until: null,
      },
      wallet: {
        id: 'wallet-3',
        user_id: 'user-3',
        remaining_seconds: 1200,
        lifetime_seconds_purchased: 7200,
        lifetime_seconds_used: 6000,
        status: 'active',
      },
    });
    userMocks.setUserAccountStatusAtomic.mockResolvedValue({
      user_id: 'user-3',
      account_status: 'suspended',
      wallet_status: 'locked',
    });
    sessionMocks.updateOpenSessionsStatusForUser.mockResolvedValue({
      count: 1,
      sessions: [],
    });

    const { updateUserStatus } = await import('@/lib/admin/service');
    const result = await updateUserStatus({
      userId: 'user-3',
      status: 'suspended',
      reason: 'Cooling-off period',
      suspendedUntil,
      actorUserId: 'admin-1',
      actorRole: 'admin',
    });

    expect(result).toEqual(
      expect.objectContaining({
        accountStatus: 'suspended',
        walletStatus: 'locked',
        suspendedUntil,
        openSessionsClosed: 1,
      }),
    );
    expect(supabaseMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status_reason: 'Cooling-off period',
        status_changed_by: 'admin-1',
        suspended_until: suspendedUntil,
      }),
    );
    expect(auditMocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: expect.objectContaining({
          accountStatus: 'suspended',
          suspendedUntil,
          openSessionsClosed: 1,
        }),
      }),
    );
  });
});
