import { assertWalletSpendable } from '@/lib/billing/wallet';
import { RouteError } from '@/lib/http/route';
import {
  createActiveSession,
  getOpenSessionForUser,
  getSessionByIdForUser,
  settleSessionUsageAtomic,
  sumUsageDebitsForUserSince,
  updateSessionStatus,
} from '@/lib/supabase/sessions';
import { getUserAccessOverrideByUserId } from '@/lib/supabase/users';
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
  minimumSeconds?: number;
}) {
  const session = await requireMutableSession(params.userId, params.sessionId);
  return settleSessionUsageAtomic({
    userId: params.userId,
    sessionId: session.id,
    minimumSeconds: params.minimumSeconds ?? 0,
  });
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
