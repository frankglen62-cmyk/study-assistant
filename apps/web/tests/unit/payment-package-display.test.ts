import { describe, expect, it } from 'vitest';

import {
  buildPaymentPackageDisplay,
  formatPaymentPackageDurationLabel,
  formatPaymentPackageDurationSummary,
} from '@/lib/payments/package-display';

describe('payment package display helpers', () => {
  it('formats exact-hour durations into readable labels', () => {
    expect(formatPaymentPackageDurationLabel(60 * 60)).toBe('1 hour');
    expect(formatPaymentPackageDurationLabel(3 * 60 * 60)).toBe('3 hours');
  });

  it('formats mixed-hour durations into readable labels', () => {
    expect(formatPaymentPackageDurationLabel(90 * 60)).toBe('1 hour 30 minutes');
    expect(formatPaymentPackageDurationSummary(90 * 60)).toBe(
      '1 hour 30 minutes of active study time',
    );
  });

  it('flags when the custom package name differs from the credited duration label', () => {
    const display = buildPaymentPackageDisplay({
      id: 'pkg_1',
      code: 'weekend-pass',
      name: 'Weekend Pass',
      description: 'Extended review bundle',
      secondsToCredit: 3 * 60 * 60,
      amountMinor: 29000,
      currency: 'PHP',
    });

    expect(display.durationLabel).toBe('3 hours');
    expect(display.hasDistinctName).toBe(true);
    expect(display.hasMarketingName).toBe(true);
    expect(display.price).toBe('₱290.00');
  });

  it('treats matching duration-style names as the same visible label', () => {
    const display = buildPaymentPackageDisplay({
      id: 'pkg_2',
      code: 'three-hours',
      name: '3 Hours',
      description: 'Standard plan',
      secondsToCredit: 3 * 60 * 60,
      amountMinor: 29000,
      currency: 'PHP',
    });

    expect(display.hasDistinctName).toBe(false);
    expect(display.hasMarketingName).toBe(false);
  });

  it('does not surface a duration-style name when it disagrees with the credited duration', () => {
    const display = buildPaymentPackageDisplay({
      id: 'pkg_3',
      code: 'mismatched',
      name: '2 Hours',
      description: 'Admin entered the wrong name',
      secondsToCredit: 3 * 60 * 60,
      amountMinor: 29000,
      currency: 'PHP',
    });

    expect(display.durationLabel).toBe('3 hours');
    expect(display.hasDistinctName).toBe(true);
    expect(display.hasMarketingName).toBe(false);
  });
});
