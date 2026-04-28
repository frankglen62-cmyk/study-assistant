import { formatCurrency } from '@study-assistant/shared-utils';

interface PaymentPackageDisplayInput {
  id: string;
  code: string;
  name: string;
  description: string;
  secondsToCredit: number;
  amountMinor: number;
  currency: string;
  creditExpiresAfterDays?: number | null;
}

export interface PaymentPackageDisplay {
  id: string;
  code: string;
  name: string;
  description: string;
  secondsToCredit: number;
  minutesToCredit: number;
  amountMinor: number;
  currency: string;
  price: string;
  durationLabel: string;
  durationSummary: string;
  hasDistinctName: boolean;
  hasMarketingName: boolean;
  featured: boolean;
  creditExpiresAfterDays: number | null;
  expirySummary: string;
}

const DURATION_TOKEN_PATTERN = /\b(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/;

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatPaymentPackageDurationLabel(secondsToCredit: number) {
  const minutesToCredit = Math.max(1, Math.round(secondsToCredit / 60));
  const hours = Math.floor(minutesToCredit / 60);
  const minutes = minutesToCredit % 60;

  if (hours > 0 && minutes === 0) {
    return pluralize(hours, 'hour');
  }

  if (hours === 0) {
    return pluralize(minutesToCredit, 'minute');
  }

  return `${pluralize(hours, 'hour')} ${pluralize(minutes, 'minute')}`;
}

export function formatPaymentPackageDurationSummary(secondsToCredit: number) {
  return `${formatPaymentPackageDurationLabel(secondsToCredit)} of active study time`;
}

export function buildPaymentPackageDisplay(
  entry: PaymentPackageDisplayInput,
  options?: { featured?: boolean },
): PaymentPackageDisplay {
  const durationLabel = formatPaymentPackageDurationLabel(entry.secondsToCredit);
  const normalizedName = normalizeLabel(entry.name);
  const normalizedDuration = normalizeLabel(durationLabel);
  const hasDistinctName = normalizedName !== normalizedDuration;
  const nameLooksLikeDuration = DURATION_TOKEN_PATTERN.test(normalizedName);
  const creditExpiresAfterDays = entry.creditExpiresAfterDays ?? null;

  return {
    id: entry.id,
    code: entry.code,
    name: entry.name,
    description: entry.description,
    secondsToCredit: entry.secondsToCredit,
    minutesToCredit: Math.max(1, Math.round(entry.secondsToCredit / 60)),
    amountMinor: entry.amountMinor,
    currency: entry.currency,
    price: formatCurrency(entry.amountMinor, entry.currency),
    durationLabel,
    durationSummary: formatPaymentPackageDurationSummary(entry.secondsToCredit),
    hasDistinctName,
    hasMarketingName: hasDistinctName && !nameLooksLikeDuration,
    featured: options?.featured ?? false,
    creditExpiresAfterDays,
    expirySummary:
      creditExpiresAfterDays === null
        ? 'Credits never expire'
        : `Credits expire ${creditExpiresAfterDays} day${creditExpiresAfterDays === 1 ? '' : 's'} after payment`,
  };
}
