import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const sessionMocks = vi.hoisted(() => ({
  createActiveSession: vi.fn(),
  getOpenSessionForUser: vi.fn(),
  getSessionByIdForUser: vi.fn(),
  updateSessionStatus: vi.fn(),
}));

vi.mock('@/lib/supabase/sessions', () => sessionMocks);

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
});
