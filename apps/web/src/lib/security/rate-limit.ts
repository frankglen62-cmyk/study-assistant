import { RouteError } from '@/lib/http/route';
import { logEvent } from '@/lib/observability/logger';

interface RateLimitRule {
  max: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate-limit store.
 *
 * SERVERLESS NOTE: On platforms like Vercel, each function instance keeps
 * its own Map. This means rate limits are per-instance, not global.
 * For a production-grade distributed rate limiter, replace this with
 * Upstash Redis or Vercel KV. The per-instance approach still provides
 * meaningful protection against sustained abuse from a single client
 * hitting the same warm instance.
 */
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
      key,
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
