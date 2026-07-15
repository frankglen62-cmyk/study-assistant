import { normalizeAppUrl } from '@study-assistant/shared-utils';

function isLoopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]' || normalized === '::1';
}

export function normalizeSecureAppUrl(value: string) {
  const normalized = normalizeAppUrl(value);
  const parsed = new URL(normalized);

  if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    return normalized;
  }

  throw new Error('The app connection must use HTTPS. HTTP is allowed only for local development.');
}
