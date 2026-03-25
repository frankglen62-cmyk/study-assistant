import { z } from 'zod';

export const passwordPolicy = {
  minLength: 12,
  checks: [
    { id: 'length', label: 'At least 12 characters', test: (value: string) => value.length >= 12 },
    { id: 'lower', label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
    { id: 'upper', label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
    { id: 'number', label: 'One number', test: (value: string) => /\d/.test(value) },
    { id: 'symbol', label: 'One symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
  ],
} as const;

export function evaluatePasswordPolicy(password: string) {
  return passwordPolicy.checks.map((check) => ({
    ...check,
    passed: check.test(password),
  }));
}

export function isStrongPassword(password: string) {
  return evaluatePasswordPolicy(password).every((check) => check.passed);
}

export const strongPasswordSchema = z.string().superRefine((value, ctx) => {
  for (const check of evaluatePasswordPolicy(value)) {
    if (!check.passed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Password requirement missing: ${check.label}.`,
      });
    }
  }
});
