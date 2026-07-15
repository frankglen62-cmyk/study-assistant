import { RouteError } from '@/lib/http/route';
import { logEvent } from '@/lib/observability/logger';
import { sha256Hex } from '@/lib/security/hash';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';

interface RateLimitRule {
  max: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Fast per-instance rejection layer. Security-sensitive routes additionally
 * call `assertDistributedRateLimit`, whose authoritative counter is updated
 * atomically in Postgres and is shared by every serverless instance. */
const rateLimitStore = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}

export function assertRateLimit(key: string, rule: RateLimitRule) {
  const now = Date.now();
  maybeCleanup();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + rule.windowMs,
    });
    return;
  }

  if (current.count >= rule.max) {
    logEvent('warn', 'rate_limit.rejected', {
      keyHashPrefix: sha256Hex(key).slice(0, 12),
      max: rule.max,
      windowMs: rule.windowMs,
      currentCount: current.count,
    });
    throw new RouteError(429, 'rate_limited', 'Too many requests. Please try again shortly.');
  }

  rateLimitStore.set(key, {
    ...current,
    count: current.count + 1,
  });
}

export async function assertDistributedRateLimit(key: string, rule: RateLimitRule) {
  assertRateLimit(key, rule);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('consume_security_rate_limit', {
    p_key_hash: sha256Hex(key),
    p_max_requests: rule.max,
    p_window_ms: rule.windowMs,
  });

  assertSupabaseResult(error, 'Failed to enforce the security rate limit.');

  const result = data as { allowed?: unknown; count?: unknown; resetAt?: unknown } | null;
  if (!result || typeof result.allowed !== 'boolean') {
    throw new RouteError(500, 'invalid_database_shape', 'Security rate limit returned an invalid result.');
  }

  if (!result.allowed) {
    logEvent('warn', 'rate_limit.distributed_rejected', {
      keyHashPrefix: sha256Hex(key).slice(0, 12),
      max: rule.max,
      windowMs: rule.windowMs,
      currentCount: typeof result.count === 'number' ? result.count : null,
      resetAt: typeof result.resetAt === 'string' ? result.resetAt : null,
    });
    throw new RouteError(429, 'rate_limited', 'Too many requests. Please try again shortly.');
  }
}

/* ------------------------------------------------------------------ */
/*  Standard presets used across routes                                */
/* ------------------------------------------------------------------ */

/** Admin read endpoints – 120 req / hour */
export const RL_ADMIN_READ: RateLimitRule = { max: 120, windowMs: 60 * 60 * 1000 };

/** Admin mutation endpoints – 60 req / hour */
export const RL_ADMIN_MUTATE: RateLimitRule = { max: 60, windowMs: 60 * 60 * 1000 };

/** Admin high-volume mutations (e.g. user management) – 120 req / hour */
export const RL_ADMIN_HIGH: RateLimitRule = { max: 120, windowMs: 60 * 60 * 1000 };

/** Client read endpoints – 120 req / hour */
export const RL_CLIENT_READ: RateLimitRule = { max: 120, windowMs: 60 * 60 * 1000 };

/** Client mutation endpoints – 30 req / hour */
export const RL_CLIENT_MUTATE: RateLimitRule = { max: 30, windowMs: 60 * 60 * 1000 };

/** Auth-sensitive endpoints (OTP, login) – 10 req / 10 min */
export const RL_AUTH_SENSITIVE: RateLimitRule = { max: 10, windowMs: 10 * 60 * 1000 };

/** Auth verification (OTP verify, code exchange) – 20 req / 10 min */
export const RL_AUTH_VERIFY: RateLimitRule = { max: 20, windowMs: 10 * 60 * 1000 };
