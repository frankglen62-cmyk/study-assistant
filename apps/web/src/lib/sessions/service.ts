import { env } from '@/lib/env/server';
import { assertWalletSpendable } from '@/lib/billing/wallet';
import { RouteError } from '@/lib/http/route';
import {
  createActiveSession,
  getOpenSessionForUser,
  getSessionByIdForUser,
  updateSessionStatus,
} from '@/lib/supabase/sessions';
import type { SessionRecord } from '@/lib/supabase/schemas';

export async function startSession(params: {
  userId: string;
  installationId: string | null;
  remainingSeconds: number;
  walletStatus: 'active' | 'locked';
  detectionMode: 'auto' | 'manual';
}) {
  assertWalletSpendable({
    walletStatus: params.walletStatus,
    remainingSeconds: params.remainingSeconds,
    requiredSeconds: env.ANALYSIS_DEBIT_SECONDS,
    lockedMessage: 'Wallet access is locked. Contact support or an administrator.',
    insufficientMessage: 'At least one minute of credits is required to start a session.',
  });

  const existing = await getOpenSessionForUser(params.userId);
  if (existing?.status === 'active') {
    return existing;
  }

  if (existing?.status === 'paused') {
    return updateSessionStatus({
      sessionId: existing.id,
      userId: params.userId,
      status: 'active',
    });
  }

  return createActiveSession({
    userId: params.userId,
    installationId: params.installationId,
    detectionMode: params.detectionMode,
  });
}

export async function pauseSession(params: { userId: string; sessionId?: string | null }) {
  const session = await requireMutableSession(params.userId, params.sessionId);

  if (session.status === 'paused') {
    return session;
  }

  return updateSessionStatus({
    sessionId: session.id,
    userId: params.userId,
    status: 'paused',
  });
}

export async function resumeSession(params: {
  userId: string;
  sessionId?: string | null;
  remainingSeconds: number;
  walletStatus: 'active' | 'locked';
}) {
  assertWalletSpendable({
    walletStatus: params.walletStatus,
    remainingSeconds: params.remainingSeconds,
    requiredSeconds: env.ANALYSIS_DEBIT_SECONDS,
    lockedMessage: 'Wallet access is locked. Contact support or an administrator.',
    insufficientMessage: 'At least one minute of credits is required to resume a session.',
  });

  const session = await requireMutableSession(params.userId, params.sessionId);

  if (session.status === 'active') {
    return session;
  }

  return updateSessionStatus({
    sessionId: session.id,
    userId: params.userId,
    status: 'active',
  });
}

export async function endSession(params: { userId: string; sessionId?: string | null }) {
  const session = await requireMutableSession(params.userId, params.sessionId);
  if (session.status === 'ended') {
    return session;
  }

  return updateSessionStatus({
    sessionId: session.id,
    userId: params.userId,
    status: 'ended',
  });
}

export async function requireActiveSession(userId: string, sessionId?: string | null) {
  const session = await requireMutableSession(userId, sessionId);
  if (session.status !== 'active') {
    throw new RouteError(409, 'session_not_active', 'The current session must be active to analyze a page.');
  }
  return session;
}

async function requireMutableSession(userId: string, sessionId?: string | null): Promise<SessionRecord> {
  if (sessionId) {
    return getSessionByIdForUser(sessionId, userId);
  }

  const session = await getOpenSessionForUser(userId);
  if (!session) {
    throw new RouteError(404, 'session_not_found', 'An active or paused session was not found.');
  }

  return session;
}
