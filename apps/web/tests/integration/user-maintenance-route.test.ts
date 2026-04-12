import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const userMocks = vi.hoisted(() => ({
  restoreElapsedSuspensions: vi.fn(),
  processExpiredWalletGrants: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@/lib/supabase/users', () => userMocks);
vi.mock('@/lib/observability/audit', () => auditMocks);

describe('user maintenance cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without the cron bearer secret', async () => {
    const { GET } = await import('@/app/api/cron/user-maintenance/route');
    const response = await GET(new Request('http://localhost:3000/api/cron/user-maintenance'));
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('cron_unauthorized');
  });

  it('processes expired suspensions and wallet grants', async () => {
    userMocks.restoreElapsedSuspensions.mockResolvedValue([
      {
        user_id: 'user-1',
        email: 'client@example.com',
        previous_reason: 'Cooling-off period',
      },
    ]);
    userMocks.processExpiredWalletGrants.mockResolvedValue([
      {
        user_id: 'user-2',
        wallet_id: 'wallet-2',
        expired_seconds: 1800,
        remaining_seconds: 900,
        expired_grant_count: 2,
      },
    ]);

    const { GET } = await import('@/app/api/cron/user-maintenance/route');
    const response = await GET(
      new Request('http://localhost:3000/api/cron/user-maintenance', {
        headers: {
          authorization: `Bearer ${process.env.EXTENSION_PAIRING_SECRET}`,
        },
      }),
    );
    const payload = (await response.json()) as {
      restoredSuspensions: number;
      expiredWallets: number;
      expiredSecondsTotal: number;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      restoredSuspensions: 1,
      expiredWallets: 1,
      expiredSecondsTotal: 1800,
    });
    expect(userMocks.restoreElapsedSuspensions).toHaveBeenCalled();
    expect(userMocks.processExpiredWalletGrants).toHaveBeenCalled();
    expect(auditMocks.writeAuditLog).toHaveBeenCalledTimes(2);
  });
});
