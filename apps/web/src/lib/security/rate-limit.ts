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

