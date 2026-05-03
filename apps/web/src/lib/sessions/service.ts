import { assertWalletSpendable } from '@/lib/billing/wallet';
import { RouteError } from '@/lib/http/route';
import { applyWalletSeconds } from '@/lib/billing/wallet';
import {
  createActiveSession,
  getOpenSessionForUser,
  getSessionByIdForUser,
  recordSessionUsage,
  sumUsageDebitsForUserSince,
  updateSessionStatus,
} from '@/lib/supabase/sessions';
import { getUserAccessOverrideByUserId, getWalletByUserId } from '@/lib/supabase/users';
import type { SessionRecord } from '@/lib/supabase/schemas';

const MINIMUM_SESSION_SECONDS = 1;

type UsageLimitKind = 'daily' | 'monthly';

interface UsageLimitState {
  blockingLimit: UsageLimitKind | null;
  allowanceLimit: UsageLimitKind | null;
  remainingAllowanceSeconds: number | null;
}

function getUsageLimitError(limit: UsageLimitKind) {
  return new RouteError(
    403,
    limit === 'daily' ? 'daily_usage_limit_reached' : 'monthly_usage_limit_reached',
    limit === 'daily'
      ? 'Daily usage limit reached for this account.'
      : 'Monthly usage limit reached for this account.',
  );
}

function getUtcDayStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function getUtcMonthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function getUsageLimitState(userId: string, now = new Date()): Promise<UsageLimitState> {
  const override = await getUserAccessOverrideByUserId(userId);
  const dailyLimit = override?.daily_usage_limit_seconds ?? null;
  const monthlyLimit = override?.monthly_usage_limit_seconds ?? null;

  if (dailyLimit === null && monthlyLimit === null) {
    return {
      blockingLimit: null,
      allowanceLimit: null,
      remainingAllowanceSeconds: null,
    };
  }

  const [dailyUsed, monthlyUsed] = await Promise.all([
    dailyLimit === null
      ? Promise.resolve(0)
      : sumUsageDebitsForUserSince({
          userId,
          since: getUtcDayStart(now),
        }),
    monthlyLimit === null
      ? Promise.resolve(0)
      : sumUsageDebitsForUserSince({
          userId,
          since: getUtcMonthStart(now),
        }),
  ]);

  const dailyRemaining = dailyLimit === null ? null : Math.max(0, dailyLimit - dailyUsed);
  const monthlyRemaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - monthlyUsed);

  const blockingLimit =
    dailyRemaining !== null && dailyRemaining <= 0
      ? 'daily'
      : monthlyRemaining !== null && monthlyRemaining <= 0
        ? 'monthly'
        : null;

  const allowanceCandidates = [
    dailyRemaining === null ? null : { kind: 'daily' as const, remaining: dailyRemaining },
    monthlyRemaining === null ? null : { kind: 'monthly' as const, remaining: monthlyRemaining },
  ].filter((value): value is { kind: UsageLimitKind; remaining: number } => value !== null);

  if (allowanceCandidates.length === 0) {
    return {
      blockingLimit,
      allowanceLimit: null,
      remainingAllowanceSeconds: null,
    };
  }

  const allowance = allowanceCandidates.reduce((current, candidate) =>
    candidate.remaining < current.remaining ? candidate : current,
  );

  return {
    blockingLimit,
    allowanceLimit: allowance.kind,
    remainingAllowanceSeconds: allowance.remaining,
  };
}

async function assertUsageLimitsNotExceeded(userId: string) {
  const limits = await getUsageLimitState(userId);
  if (limits.blockingLimit) {
    throw getUsageLimitError(limits.blockingLimit);
  }
}

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
  await assertUsageLimitsNotExceeded(params.userId);

  const existing = await getOpenSessionForUser(params.userId);

  if (existing) {
    // Security: enforce one device per active session.
    // If the session was started by a different extension installation,
    // block the new device from using or resuming it.
    const sessionOwnedByDifferentDevice =
      params.installationId &&
      existing.extension_installation_id &&
      existing.extension_installation_id !== params.installationId;

    if (sessionOwnedByDifferentDevice) {
      throw new RouteError(
        409,
        'session_device_conflict',
        'A session is already running on another device. End that session first, then try again on this device.',
      );
    }

    if (existing.status === 'active') {
      return existing;
    }

    if (existing.status === 'paused') {
      return updateSessionStatus({
        sessionId: existing.id,
        userId: params.userId,
        status: 'active',
      });
    }
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
  await assertUsageLimitsNotExceeded(params.userId);

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
  const now = new Date();
  const usageLimits = await getUsageLimitState(params.userId, now);

  if (session.status !== 'active') {
    return {
      session,
      wallet,
      consumedSeconds: 0,
      usageLimitReached: null,
    };
  }

  if (usageLimits.blockingLimit) {
    const nextSession = await recordSessionUsage({
      sessionId: session.id,
      userId: params.userId,
      usedSeconds: session.used_seconds,
      lastActivityAt: now.toISOString(),
      status: 'timed_out',
    });

    return {
      session: nextSession,
      wallet,
      consumedSeconds: 0,
      usageLimitReached: usageLimits.blockingLimit,
    };
  }

  const checkpoint = session.last_activity_at ?? session.start_time;
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(checkpoint).getTime()) / 1000));

  if (elapsedSeconds <= 0) {
    return {
      session,
      wallet,
      consumedSeconds: 0,
      usageLimitReached: null,
    };
  }

  const usageAllowance =
    usageLimits.remainingAllowanceSeconds === null
      ? Number.POSITIVE_INFINITY
      : usageLimits.remainingAllowanceSeconds;
  const consumableSeconds = Math.min(elapsedSeconds, wallet.remaining_seconds, usageAllowance);
  const reachedWalletLimit = wallet.remaining_seconds <= consumableSeconds;
  const reachedUsageLimit =
    usageLimits.remainingAllowanceSeconds !== null &&
    usageLimits.allowanceLimit !== null &&
    usageLimits.remainingAllowanceSeconds <= consumableSeconds;

  const nextStatus: SessionRecord['status'] = reachedUsageLimit
    ? 'timed_out'
    : consumableSeconds < elapsedSeconds || reachedWalletLimit
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
    usageLimitReached: reachedUsageLimit ? usageLimits.allowanceLimit : null,
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
