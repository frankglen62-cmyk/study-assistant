import { describe, expect, it } from 'vitest';

import { normalizeSecureAppUrl } from './secure-url';

describe('normalizeSecureAppUrl', () => {
  it('accepts HTTPS portal origins', () => {
    expect(normalizeSecureAppUrl('https://portal.example.com/dashboard')).toBe('https://portal.example.com');
  });

  it('allows HTTP only for loopback development hosts', () => {
    expect(normalizeSecureAppUrl('http://localhost:3000/dashboard')).toBe('http://localhost:3000');
    expect(() => normalizeSecureAppUrl('http://portal.example.com')).toThrow(/https/i);
  });
});
