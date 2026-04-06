import { z } from 'zod';

export const profileRecordSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  role: z.enum(['super_admin', 'admin', 'client']),
  account_status: z.enum(['active', 'suspended', 'pending_verification', 'banned']),
  email_2fa_enabled: z.boolean().optional().default(false),
  created_at: z.string().optional(),
});

export const walletRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  remaining_seconds: z.number().int().nonnegative(),
  lifetime_seconds_purchased: z.number().int().nonnegative(),
  lifetime_seconds_used: z.number().int().nonnegative(),
  status: z.enum(['active', 'locked']),
});

export const clientSettingsRecordSchema = z.object({
  user_id: z.string().uuid(),
  answer_style: z.enum(['concise', 'detailed']),
  show_confidence: z.boolean(),
  default_detection_mode: z.enum(['auto', 'manual']),
  low_credit_notifications: z.boolean(),
  theme_preference: z.enum(['light', 'dark', 'system']),
  language: z.string().min(1),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const subjectRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  course_code: z.string().nullable(),
  department: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  url_patterns: z.array(z.string()).default([]),
  is_active: z.boolean(),
});

export const categoryRecordSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  default_keywords: z.array(z.string()).default([]),
  is_active: z.boolean(),
});

export const paymentPackageSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  seconds_to_credit: z.number().int().positive(),
  amount_minor: z.number().int().nonnegative(),
  currency: z.string(),
  provider_price_reference: z.string().nullable(),
  is_active: z.boolean(),
});

export const paymentRecordSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(['stripe', 'paymongo']),
  provider_payment_id: z.string(),
  amount_minor: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'canceled', 'refunded']),
  payment_type: z.enum(['topup', 'subscription']),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  package_id: z.string().uuid().nullable(),
  payment_packages: z
    .object({
      code: z.string(),
      name: z.string(),
    })
    .nullable(),
});

export const installationRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  installation_status: z.enum(['active', 'revoked']),
  device_name: z.string().nullable().optional(),
  browser_name: z.string().nullable().optional(),
  extension_version: z.string().nullable(),
  last_seen_at: z.string().nullable(),
});

export const sessionRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'ended', 'timed_out', 'no_credit', 'no_match', 'failed']),
  detection_mode: z.enum(['auto', 'manual']),
  current_subject_id: z.string().uuid().nullable(),
  current_category_id: z.string().uuid().nullable(),
  used_seconds: z.number().int().nonnegative(),
  start_time: z.string(),
  last_activity_at: z.string().nullable().optional(),
  end_time: z.string().nullable(),
});

export const refreshTokenRecordSchema = z.object({
  id: z.string().uuid(),
  installation_id: z.string().uuid(),
  token_hash: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});

export const pairingCodeRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  code_hash: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
});

export const retrievalChunkSchema = z.object({
  chunk_id: z.string().uuid(),
  source_file_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  folder_id: z.string().uuid().nullable(),
  heading: z.string().nullable(),
  text_content: z.string(),
  similarity: z.number(),
  source_title: z.string(),
  source_priority: z.number().int(),
  subject_name: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  chunk_metadata: z.record(z.string(), z.unknown()),
});

export const folderRecordSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  subject_id: z.string().uuid().nullable(),
  folder_type: z.enum(['subject_root', 'category', 'custom']),
  name: z.string(),
  slug: z.string(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  archived_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const sourceFileRecordSchema = z.object({
  id: z.string().uuid(),
  folder_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  title: z.string(),
  source_status: z.enum(['draft', 'processing', 'active', 'archived', 'failed']),
  version_number: z.number().int(),
  processing_error: z.string().nullable().optional(),
  source_priority: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  activated_at: z.string().nullable(),
  profiles: z
    .object({
      full_name: z.string(),
    })
    .nullable()
    .optional(),
  subjects: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
  categories: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export const subjectQaPairRecordSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  question_text: z.string(),
  answer_text: z.string(),
  short_explanation: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  deleted_at: z.string().nullable().optional(),
  updated_at: z.string(),
  subjects: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
  categories: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export const retrievalQaPairSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  question_text: z.string(),
  answer_text: z.string(),
  short_explanation: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  sort_order: z.number().int(),
  similarity: z.number(),
  subject_name: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  updated_at: z.string(),
});

export const questionAttemptSummarySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  page_url: z.string().nullable().optional(),
  page_title: z.string().nullable().optional(),
  final_confidence: z.number().nullable().optional(),
  no_match_reason: z.string().nullable().optional(),
  answer_text: z.string().nullable().optional(),
  short_explanation: z.string().nullable().optional(),
  subjects: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
  categories: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export type ProfileRecord = z.infer<typeof profileRecordSchema>;
export type WalletRecord = z.infer<typeof walletRecordSchema>;
export type ClientSettingsRecord = z.infer<typeof clientSettingsRecordSchema>;
export type SubjectRecord = z.infer<typeof subjectRecordSchema>;
export type CategoryRecord = z.infer<typeof categoryRecordSchema>;
export type PaymentPackageRecord = z.infer<typeof paymentPackageSchema>;
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
export type InstallationRecord = z.infer<typeof installationRecordSchema>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export type RefreshTokenRecord = z.infer<typeof refreshTokenRecordSchema>;
export type PairingCodeRecord = z.infer<typeof pairingCodeRecordSchema>;
export type RetrievalChunkRecord = z.infer<typeof retrievalChunkSchema>;
export type FolderRecord = z.infer<typeof folderRecordSchema>;
export type SourceFileRecord = z.infer<typeof sourceFileRecordSchema>;
export type SubjectQaPairRecord = z.infer<typeof subjectQaPairRecordSchema>;
export type RetrievalQaPairRecord = z.infer<typeof retrievalQaPairSchema>;
export type QuestionAttemptSummaryRecord = z.infer<typeof questionAttemptSummarySchema>;
