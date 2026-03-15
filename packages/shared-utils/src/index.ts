export const PRODUCT_NAME = 'Admin-Managed AI Study Assistant';

export const CREDIT_DISPLAY_UNIT_SECONDS = 60;
export const DEFAULT_ANALYSIS_DEBIT_SECONDS = 60;
export const NO_MATCH_ANALYSIS_DEBIT_SECONDS = 0;
export const DEFAULT_EXTENSION_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
export const DEFAULT_EXTENSION_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const DEFAULT_PAIRING_CODE_TTL_SECONDS = 60 * 10;
export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.65;
export const DEFAULT_HIGH_CONFIDENCE_THRESHOLD = 0.8;

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function formatDurationDetailed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatCurrency(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeAppUrl(input: string): string {
  const url = new URL(input.startsWith('http') ? input : `https://${input}`);
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function normalizeOriginPattern(input: string): string {
  return `${normalizeAppUrl(input)}/*`;
}

export function confidenceToLevel(confidence: number | null): 'high' | 'medium' | 'low' {
  if (confidence === null) {
    return 'low';
  }

  if (confidence >= 0.8) {
    return 'high';
  }

  if (confidence >= 0.65) {
    return 'medium';
  }

  return 'low';
}

export function coercePositiveInteger(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function createShortCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = crypto.getRandomValues(new Uint32Array(length));

  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}
