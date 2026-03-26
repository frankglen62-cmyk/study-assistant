import 'server-only';

import { z } from 'zod';

import {
  DEFAULT_EXTENSION_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_EXTENSION_REFRESH_TOKEN_TTL_SECONDS,
  DEFAULT_HIGH_CONFIDENCE_THRESHOLD,
  DEFAULT_LOW_CONFIDENCE_THRESHOLD,
  DEFAULT_PAIRING_CODE_TTL_SECONDS,
  coercePositiveInteger,
} from '@study-assistant/shared-utils';

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_API_COMPAT_MODE: z.enum(['responses', 'chat_completions']).default('responses'),
  OPENAI_SUPPORTS_IMAGE_INPUT: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(20).optional(),
  PAYMONGO_SECRET_KEY: z.string().min(20).optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().min(20).optional(),
  PAYMONGO_API_BASE_URL: z.string().url().optional(),
  EXTENSION_PAIRING_SECRET: z.string().min(20),
  AUTH_EMAIL_CHALLENGE_SECRET: z.string().min(20).optional(),
  SESSION_IDLE_SECONDS: z.string().optional(),
  LOW_CREDIT_THRESHOLD_SECONDS: z.string().optional(),
  MAX_UPLOAD_SIZE_MB: z.string().optional(),
  OPENAI_EXTRACTION_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_ANSWER_MODEL: z.string().default('gpt-4.1'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_SUBJECT_MODEL: z.string().default('gpt-4.1-mini'),
  STRIPE_PRICE_CURRENCY: z.string().default('usd'),
});

const parsed = serverEnvSchema.parse(process.env);

if (parsed.STRIPE_SECRET_KEY && !parsed.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is configured.');
}

if (parsed.STRIPE_WEBHOOK_SECRET && !parsed.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required when STRIPE_WEBHOOK_SECRET is configured.');
}

if (parsed.PAYMONGO_SECRET_KEY && !parsed.PAYMONGO_WEBHOOK_SECRET) {
  throw new Error('PAYMONGO_WEBHOOK_SECRET is required when PAYMONGO_SECRET_KEY is configured.');
}

if (parsed.PAYMONGO_WEBHOOK_SECRET && !parsed.PAYMONGO_SECRET_KEY) {
  throw new Error('PAYMONGO_SECRET_KEY is required when PAYMONGO_WEBHOOK_SECRET is configured.');
}

export const env = {
  ...parsed,
  OPENAI_SUPPORTS_IMAGE_INPUT:
    parsed.OPENAI_SUPPORTS_IMAGE_INPUT !== undefined
      ? parsed.OPENAI_SUPPORTS_IMAGE_INPUT === 'true'
      : parsed.OPENAI_API_COMPAT_MODE === 'responses',
  STRIPE_ENABLED: Boolean(parsed.STRIPE_SECRET_KEY && parsed.STRIPE_WEBHOOK_SECRET),
  PAYMONGO_ENABLED: Boolean(parsed.PAYMONGO_SECRET_KEY && parsed.PAYMONGO_WEBHOOK_SECRET),
  PAYMONGO_API_BASE_URL: parsed.PAYMONGO_API_BASE_URL ?? 'https://api.paymongo.com/v1',
  SESSION_IDLE_SECONDS: coercePositiveInteger(parsed.SESSION_IDLE_SECONDS, 5 * 60),
  LOW_CREDIT_THRESHOLD_SECONDS: coercePositiveInteger(parsed.LOW_CREDIT_THRESHOLD_SECONDS, 15 * 60),
  MAX_UPLOAD_SIZE_MB: coercePositiveInteger(parsed.MAX_UPLOAD_SIZE_MB, 25),
  EXTENSION_ACCESS_TOKEN_TTL_SECONDS: DEFAULT_EXTENSION_ACCESS_TOKEN_TTL_SECONDS,
  EXTENSION_REFRESH_TOKEN_TTL_SECONDS: DEFAULT_EXTENSION_REFRESH_TOKEN_TTL_SECONDS,
  EXTENSION_PAIRING_CODE_TTL_SECONDS: DEFAULT_PAIRING_CODE_TTL_SECONDS,
  LOW_CONFIDENCE_THRESHOLD: DEFAULT_LOW_CONFIDENCE_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD: DEFAULT_HIGH_CONFIDENCE_THRESHOLD,
  ANALYSIS_DEBIT_SECONDS: 60,
  NO_MATCH_ANALYSIS_DEBIT_SECONDS: 0,
  RETRIEVAL_MATCH_COUNT: 8,
  RETRIEVAL_MIN_SIMILARITY: 0.55,
} as const;

export type ServerEnv = typeof env;
