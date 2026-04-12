import { z } from 'zod';

import { slugify } from '@study-assistant/shared-utils';

import { systemSettingsSchema } from '@/lib/platform/system-settings-schema';

const optionalSlugSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? slugify(value) : undefined));

const optionalNullableStringSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const adminUserCreditAdjustmentSchema = z.object({
  deltaSeconds: z.number().int().refine((value) => value !== 0, 'Delta must be non-zero.'),
  description: z.string().trim().min(4).max(240),
});

export const adminUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().trim().max(240).optional(),
  suspendedUntil: z
    .string()
    .datetime()
    .nullable()
    .optional(),
}).superRefine((value, context) => {
  if (value.status !== 'active' && (!value.reason || value.reason.trim().length < 4)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'Provide a short reason for this moderation action.',
    });
  }

  if (value.status !== 'suspended' && value.suspendedUntil) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['suspendedUntil'],
      message: 'A suspension end date can only be set while suspending an account.',
    });
  }

  if (value.status === 'suspended' && value.suspendedUntil) {
    const suspendedUntil = new Date(value.suspendedUntil);
    if (Number.isNaN(suspendedUntil.getTime()) || suspendedUntil.getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['suspendedUntil'],
        message: 'Suspension end must be a future date and time.',
      });
    }
  }
});

export const adminUserNoteCreateSchema = z.object({
  note: z.string().trim().min(4).max(1000),
});

export const adminUserFlagCreateSchema = z.object({
  flag: z.string().trim().min(2).max(60),
  color: z.string().trim().max(40).nullable().optional(),
});

export const adminUserFlagDeleteSchema = z.object({
  flagId: z.string().uuid(),
});

export const adminUserAccessOverrideSchema = z.object({
  canUseExtension: z.boolean(),
  canBuyCredits: z.boolean(),
  maxActiveDevices: z.number().int().min(1).max(20).nullable().optional().default(null),
  dailyUsageLimitSeconds: z.number().int().min(0).max(60 * 60 * 24 * 31).nullable().optional().default(null),
  monthlyUsageLimitSeconds: z.number().int().min(0).max(60 * 60 * 24 * 365).nullable().optional().default(null),
  featureFlags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export const adminUserDeviceRevokeSchema = z.object({
  installationId: z.string().uuid().nullable().optional(),
  revokeAll: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (!value.revokeAll && !value.installationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['installationId'],
      message: 'Select a device to revoke or choose revoke all.',
    });
  }
});

export const adminBulkUserActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['suspend', 'add_credits', 'deduct_credits']),
  reason: z.string().trim().min(4).max(240),
  minutes: z.number().int().positive().optional(),
}).superRefine((value, context) => {
  if ((value.action === 'add_credits' || value.action === 'deduct_credits') && !value.minutes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minutes'],
      message: 'Credit bulk actions require a minute amount.',
    });
  }
});

export const adminSystemSettingsUpdateSchema = systemSettingsSchema;

export const adminPaymentPackageUpdateSchema = z.object({
  code: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? slugify(value) : undefined)),
  name: z.string().trim().min(2).max(120),
  description: optionalNullableStringSchema,
  minutesToCredit: z.number().int().min(1).max(60 * 24 * 30),
  priceMajor: z.number().positive().max(1_000_000),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  creditExpiresAfterDays: z.number().int().min(1).max(3650).nullable().optional().default(null),
});

export const adminPaymentPackageCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? slugify(value) : undefined)),
  name: z.string().trim().min(2).max(120),
  description: optionalNullableStringSchema,
  minutesToCredit: z.number().int().min(1).max(60 * 24 * 30),
  priceMajor: z.number().positive().max(1_000_000),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  creditExpiresAfterDays: z.number().int().min(1).max(3650).nullable().optional().default(null),
});

export const adminSubjectMutationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: optionalSlugSchema,
  courseCode: optionalNullableStringSchema,
  department: optionalNullableStringSchema,
  description: optionalNullableStringSchema,
  keywords: z.array(z.string().trim().min(1).max(80)).max(30),
  urlPatterns: z.array(z.string().trim().min(1).max(240)).max(30),
  isActive: z.boolean().optional().default(true),
});

export const adminCategoryMutationSchema = z.object({
  subjectId: z.string().uuid().nullable().optional().default(null),
  name: z.string().trim().min(2).max(120),
  slug: optionalSlugSchema,
  description: optionalNullableStringSchema,
  defaultKeywords: z.array(z.string().trim().min(1).max(80)).max(30),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const adminFolderCreateSchema = z.object({
  parentId: z.string().uuid().nullable().optional().default(null),
  subjectId: z.string().uuid().nullable().optional().default(null),
  folderType: z.enum(['subject_root', 'category', 'custom']),
  name: z.string().trim().min(2).max(120),
  slug: optionalSlugSchema,
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const adminFolderUpdateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rename'),
    name: z.string().trim().min(2).max(120),
    slug: optionalSlugSchema,
  }),
  z.object({
    action: z.literal('move'),
    parentId: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal('archive'),
  }),
  z.object({
    action: z.literal('delete'),
  }),
]);

export const adminSourceMetadataSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rename'),
    title: z.string().trim().min(2).max(180),
  }),
  z.object({
    action: z.literal('move'),
    folderId: z.string().uuid(),
    subjectId: z.string().uuid(),
    categoryId: z.string().uuid().nullable().optional().default(null),
  }),
  z.object({
    action: z.literal('archive'),
  }),
  z.object({
    action: z.literal('set_activation'),
    active: z.boolean(),
  }),
]);

export const adminSourceUploadPayloadSchema = z.object({
  title: z.string().trim().min(2).max(180),
  subjectId: z.string().uuid(),
  folderId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional().default(null),
  description: optionalNullableStringSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  sourcePriority: z.number().int().min(0).max(1000).default(0),
  activateOnSuccess: z.boolean().default(true),
});

export const adminSubjectQaPairCreateSchema = z.object({
  subjectId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional().default(null),
  questionText: z.string().trim().min(1).max(1200),
  answerText: z.string().trim().min(1).max(2400),
  shortExplanation: optionalNullableStringSchema,
  keywords: z.array(z.string().trim().min(1).max(80)).max(30),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  questionType: z.enum(['multiple_choice', 'fill_in_blank', 'checkbox', 'dropdown', 'picture']).optional().default('multiple_choice'),
  questionImageUrl: z.string().trim().nullable().optional().default(null),
});

export const adminSubjectQaPairUpdateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    subjectId: z.string().uuid(),
    categoryId: z.string().uuid().nullable().optional().default(null),
    questionText: z.string().trim().min(1).max(1200),
    answerText: z.string().trim().min(1).max(2400),
    shortExplanation: optionalNullableStringSchema,
    keywords: z.array(z.string().trim().min(1).max(80)).max(30),
    sortOrder: z.number().int().min(0).optional().default(0),
    isActive: z.boolean().optional().default(true),
    questionType: z.enum(['multiple_choice', 'fill_in_blank', 'checkbox', 'dropdown', 'picture']).optional().default('multiple_choice'),
    questionImageUrl: z.string().trim().nullable().optional().default(null),
  }),
  z.object({
    action: z.literal('set_activation'),
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal('delete'),
  }),
]);

export function parseDelimitedTextList(input: string | null | undefined) {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
