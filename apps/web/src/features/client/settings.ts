import { z } from 'zod';

import type { ClientSettings } from '@study-assistant/shared-types';

export const clientSettingsDefaults: ClientSettings = {
  answerStyle: 'concise',
  showConfidence: true,
  detectionMode: 'auto',
  lowCreditNotifications: true,
  theme: 'system',
  language: 'English',
};

export const clientSettingsSchema = z.object({
  answerStyle: z.enum(['concise', 'detailed']),
  showConfidence: z.boolean(),
  detectionMode: z.enum(['auto', 'manual']),
  lowCreditNotifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  language: z.string().trim().min(2, 'Choose a language.').max(64, 'Language is too long.'),
});

export type ClientSettingsValues = z.infer<typeof clientSettingsSchema>;

export function normalizeClientSettings(input?: Partial<ClientSettings> | null): ClientSettings {
  return {
    answerStyle: input?.answerStyle ?? clientSettingsDefaults.answerStyle,
    showConfidence: input?.showConfidence ?? clientSettingsDefaults.showConfidence,
    detectionMode: input?.detectionMode ?? clientSettingsDefaults.detectionMode,
    lowCreditNotifications: input?.lowCreditNotifications ?? clientSettingsDefaults.lowCreditNotifications,
    theme: input?.theme ?? clientSettingsDefaults.theme,
    language: input?.language?.trim() || clientSettingsDefaults.language,
  };
}
