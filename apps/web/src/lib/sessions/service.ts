import { assertWalletSpendable } from '@/lib/billing/wallet';
import { RouteError } from '@/lib/http/route';
import { applyWalletSeconds } from '@/lib/billing/wallet';
import {
  createActiveSession,
  getOpenSessionForUser,
  getSessionByIdForUser,
  recordSessionUsage,
  updateSessionStatus,
} from '@/lib/supabase/sessions';
import { getWalletByUserId } from '@/lib/supabase/users';
import type { SessionRecord } from '@/lib/supabase/schemas';

const MINIMUM_SESSION_SECONDS = 1;

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
    requiredSeconds: MINIMUM_SESSION_SECONDS,
    lockedMessage: 'Wallet access is locked. Contact support or an administrator.',
    insufficientMessage: 'At least one second of credits is required to start a session.',
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
    requiredSeconds: MINIMUM_SESSION_SECONDS,
    lockedMessage: 'Wallet access is locked. Contact support or an administrator.',
    insufficientMessage: 'At least one second of credits is required to resume a session.',
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

export async function settleActiveSessionUsage(params: {
  userId: string;
  sessionId?: string | null;
}) {
  const session = await requireMutableSession(params.userId, params.sessionId);
  const wallet = await getWalletByUserId(params.userId);

  if (session.status !== 'active') {
    return {
      session,
      wallet,
      consumedSeconds: 0,
    };
  }

  const now = new Date();
  const checkpoint = session.last_activity_at ?? session.start_time;
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(checkpoint).getTime()) / 1000));

  if (elapsedSeconds <= 0) {
    return {
      session,
      wallet,
      consumedSeconds: 0,
    };
  }

  const consumableSeconds = Math.min(elapsedSeconds, wallet.remaining_seconds);
  const nextStatus: SessionRecord['status'] = consumableSeconds < elapsedSeconds || wallet.remaining_seconds <= consumableSeconds
    ? 'no_credit'
    : 'active';

  let nextWallet = wallet;
  if (consumableSeconds > 0) {
    const updatedWalletInfo = await applyWalletSeconds({
      userId: params.userId,
      deltaSeconds: consumableSeconds * -1,
      transactionType: 'usage_debit',
      description: 'Live study session time usage',
      relatedSessionId: session.id,
      metadata: {
        source: 'session_usage',
        elapsedSeconds,
        consumedSeconds: consumableSeconds,
      },
    });
    
    nextWallet = {
      ...wallet,
      remaining_seconds: updatedWalletInfo.remaining_seconds,
      lifetime_seconds_purchased: updatedWalletInfo.lifetime_seconds_purchased,
      lifetime_seconds_used: updatedWalletInfo.lifetime_seconds_used,
    };
  }

  const nextSession = await recordSessionUsage({
    sessionId: session.id,
    userId: params.userId,
    usedSeconds: session.used_seconds + consumableSeconds,
    lastActivityAt: now.toISOString(),
    status: nextStatus,
  });

  return {
    session: nextSession,
    wallet: nextWallet,
    consumedSeconds: consumableSeconds,
  };
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
