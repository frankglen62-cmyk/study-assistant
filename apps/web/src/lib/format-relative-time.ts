const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(
  input: string | number | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (input === null || input === undefined) {
    return 'Never';
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }

  const diffMs = now.getTime() - date.getTime();
  const absDiffMs = Math.abs(diffMs);
  const future = diffMs < 0;

  function format(value: number, unit: string): string {
    const rounded = Math.max(1, Math.round(value));
    const label = `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
    return future ? `in ${label}` : `${label} ago`;
  }

  if (absDiffMs < 30 * SECOND) {
    return future ? 'in a few seconds' : 'just now';
  }

  if (absDiffMs < MINUTE) {
    return format(absDiffMs / SECOND, 'second');
  }

  if (absDiffMs < HOUR) {
    return format(absDiffMs / MINUTE, 'minute');
  }

  if (absDiffMs < DAY) {
    return format(absDiffMs / HOUR, 'hour');
  }

  if (absDiffMs < WEEK) {
    return format(absDiffMs / DAY, 'day');
  }

  if (absDiffMs < MONTH) {
    return format(absDiffMs / WEEK, 'week');
  }

  if (absDiffMs < YEAR) {
    return format(absDiffMs / MONTH, 'month');
  }

  return format(absDiffMs / YEAR, 'year');
}
