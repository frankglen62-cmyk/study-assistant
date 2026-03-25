import { isStrongPassword } from '@/features/auth/password-policy';

describe('password policy', () => {
  it('accepts strong passwords', () => {
    expect(isStrongPassword('StudyAssistant!2026')).toBe(true);
  });

  it('rejects weak passwords', () => {
    expect(isStrongPassword('password')).toBe(false);
    expect(isStrongPassword('lowercaseonly123')).toBe(false);
    expect(isStrongPassword('NO-SYMBOL-123')).toBe(false);
  });
});
