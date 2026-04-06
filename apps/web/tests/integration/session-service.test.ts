import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const sessionMocks = vi.hoisted(() => ({
  createActiveSession: vi.fn(),
  getOpenSessionForUser: vi.fn(),
  getSessionByIdForUser: vi.fn(),
  recordSessionUsage: vi.fn(),
  updateSessionStatus: vi.fn(),
}));

const walletMocks = vi.hoisted(() => ({
  applyWalletSeconds: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  getWalletByUserId: vi.fn(),
}));

vi.mock('@/lib/supabase/sessions', () => sessionMocks);
vi.mock('@/lib/billing/wallet', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billing/wallet')>('@/lib/billing/wallet');

  return {
    ...actual,
    applyWalletSeconds: walletMocks.applyWalletSeconds,
  };
});
vi.mock('@/lib/supabase/users', () => userMocks);

describe('session service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a new session when the wallet is spendable and no session is open', async () => {
    sessionMocks.getOpenSessionForUser.mockResolvedValue(null);
    sessionMocks.createActiveSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: 'active',
      detection_mode: 'auto',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 0,
      start_time: new Date().toISOString(),
      end_time: null,
    });

    const { startSession } = await import('@/lib/sessions/service');
    const session = await startSession({
      userId: 'user-1',
      installationId: 'installation-1',
      remainingSeconds: 3600,
      walletStatus: 'active',
      detectionMode: 'manual',
    });

    expect(session.id).toBe('session-1');
    expect(sessionMocks.createActiveSession).toHaveBeenCalledOnce();
  });

  it('blocks session start when the wallet is locked', async () => {
    const { startSession } = await import('@/lib/sessions/service');

    await expect(
      startSession({
        userId: 'user-1',
        installationId: null,
        remainingSeconds: 3600,
        walletStatus: 'locked',
        detectionMode: 'auto',
      }),
    ).rejects.toThrow(/locked/i);
  });

  it('ends the open session through the stored session helper', async () => {
    sessionMocks.getOpenSessionForUser.mockResolvedValue({
      id: 'session-2',
      user_id: 'user-1',
      status: 'active',
      detection_mode: 'manual',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 120,
      start_time: new Date().toISOString(),
      end_time: null,
    });
    sessionMocks.updateSessionStatus.mockResolvedValue({
      id: 'session-2',
      user_id: 'user-1',
      status: 'ended',
      detection_mode: 'manual',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 120,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
    });

    const { endSession } = await import('@/lib/sessions/service');
    const session = await endSession({ userId: 'user-1' });

    expect(session.status).toBe('ended');
    expect(sessionMocks.updateSessionStatus).toHaveBeenCalledOnce();
  });

  it('pauses the open session when a live session exists', async () => {
    sessionMocks.getOpenSessionForUser.mockResolvedValue({
      id: 'session-3',
      user_id: 'user-1',
      status: 'active',
      detection_mode: 'manual',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 90,
      start_time: new Date().toISOString(),
      end_time: null,
    });
    sessionMocks.updateSessionStatus.mockResolvedValue({
      id: 'session-3',
      user_id: 'user-1',
      status: 'paused',
      detection_mode: 'manual',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 90,
      start_time: new Date().toISOString(),
      end_time: null,
    });

    const { pauseSession } = await import('@/lib/sessions/service');
    const session = await pauseSession({ userId: 'user-1' });

    expect(session.status).toBe('paused');
    expect(sessionMocks.updateSessionStatus).toHaveBeenCalledOnce();
  });

  it('resumes a paused session when the wallet can spend', async () => {
    sessionMocks.getOpenSessionForUser.mockResolvedValue({
      id: 'session-4',
      user_id: 'user-1',
      status: 'paused',
      detection_mode: 'auto',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 150,
      start_time: new Date().toISOString(),
      end_time: null,
    });
    sessionMocks.updateSessionStatus.mockResolvedValue({
      id: 'session-4',
      user_id: 'user-1',
      status: 'active',
      detection_mode: 'auto',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 150,
      start_time: new Date().toISOString(),
      end_time: null,
    });

    const { resumeSession } = await import('@/lib/sessions/service');
    const session = await resumeSession({
      userId: 'user-1',
      remainingSeconds: 3600,
      walletStatus: 'active',
    });

    expect(session.status).toBe('active');
    expect(sessionMocks.updateSessionStatus).toHaveBeenCalledOnce();
  });

  it('settles active session time against the wallet before returning control', async () => {
    const now = new Date('2026-04-06T10:10:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    sessionMocks.getSessionByIdForUser.mockResolvedValue({
      id: 'session-5',
      user_id: 'user-1',
      status: 'active',
      detection_mode: 'manual',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 120,
      start_time: new Date('2026-04-06T10:00:00.000Z').toISOString(),
      last_activity_at: new Date('2026-04-06T10:09:20.000Z').toISOString(),
      end_time: null,
    });
    userMocks.getWalletByUserId.mockResolvedValue({
      id: 'wallet-1',
      user_id: 'user-1',
      remaining_seconds: 600,
      lifetime_seconds_purchased: 1200,
      lifetime_seconds_used: 600,
      status: 'active',
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      wallet_id: 'wallet-1',
      remaining_seconds: 560,
      lifetime_seconds_purchased: 1200,
      lifetime_seconds_used: 640,
    });
    sessionMocks.recordSessionUsage.mockResolvedValue({
      id: 'session-5',
      user_id: 'user-1',
      status: 'active',
      detection_mode: 'manual',
      current_subject_id: null,
      current_category_id: null,
      used_seconds: 160,
      start_time: new Date('2026-04-06T10:00:00.000Z').toISOString(),
      last_activity_at: now.toISOString(),
      end_time: null,
    });

    const { settleActiveSessionUsage } = await import('@/lib/sessions/service');
    const result = await settleActiveSessionUsage({
      userId: 'user-1',
      sessionId: 'session-5',
    });

    expect(result.consumedSeconds).toBe(40);
    expect(walletMocks.applyWalletSeconds).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        deltaSeconds: -40,
        relatedSessionId: 'session-5',
      }),
    );
    expect(sessionMocks.recordSessionUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-5',
        userId: 'user-1',
        usedSeconds: 160,
        status: 'active',
      }),
    );

    vi.useRealTimers();
  });
});
