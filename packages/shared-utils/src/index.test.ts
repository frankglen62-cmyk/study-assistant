import { confidenceToLevel, formatDurationDetailed, normalizeAppUrl } from './index';

describe('shared utils', () => {
  it('formats detailed durations', () => {
    expect(formatDurationDetailed(3661)).toBe('1h 1m 1s');
  });

  it('normalizes app urls to origins', () => {
    expect(normalizeAppUrl('https://example.com/portal?x=1')).toBe('https://example.com');
  });

  it('maps confidence levels using configured thresholds', () => {
    expect(confidenceToLevel(0.82)).toBe('high');
    expect(confidenceToLevel(0.72)).toBe('medium');
    expect(confidenceToLevel(0.2)).toBe('low');
    expect(confidenceToLevel(null)).toBe('low');
  });
});
