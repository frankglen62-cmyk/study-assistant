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
  status: z.enum(['active', 'suspended']),
});

export const adminSystemSettingsUpdateSchema = systemSettingsSchema;

export const adminPaymentPackageUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalNullableStringSchema,
  minutesToCredit: z.number().int().min(1).max(60 * 24 * 30),
  priceMajor: z.number().positive().max(1_000_000),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
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
