import { z } from 'zod';

export const systemSettingsSchema = z.object({
  lowCreditThresholdSeconds: z.coerce.number().int().min(60).default(900),
  sessionIdleSeconds: z.coerce.number().int().min(60).default(300),
  liveModeDefault: z.enum(['disabled', 'confirm', 'enabled']).default('confirm'),
  confidenceThresholds: z.string().trim().default('high=0.80, medium=0.65'),
  allowedFileTypes: z.string().trim().default('pdf, docx, pptx, txt, md, csv, jpg, png, webp, zip'),
  maxUploadSizeMb: z.coerce.number().int().min(1).default(100),
  systemBanner: z.string().default(''),
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z
    .string()
    .trim()
    .max(500)
    .default('The platform is temporarily under maintenance. Please try again shortly.'),
  allowNewRegistrations: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(true),
  showDefaultCreditPackages: z.boolean().default(true),
  extensionPairingExpiration: z.coerce.number().int().min(60).default(600),
  rateLimitDefaults: z.coerce.number().int().min(10).default(120),
  supportEmail: z.string().trim().email().default('support@study-assistant.com'),
  platformName: z.string().trim().min(2).max(120).default('Study Assistant'),
});

export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const defaultSystemSettings: SystemSettings = systemSettingsSchema.parse({});
