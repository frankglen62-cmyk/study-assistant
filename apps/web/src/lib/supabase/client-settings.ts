import 'server-only';

import type { ClientSettings } from '@study-assistant/shared-types';

import { normalizeClientSettings } from '@/features/client/settings';

import { clientSettingsRecordSchema, type ClientSettingsRecord } from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseSingle } from './utils';

function mapRecordToSettings(record: ClientSettingsRecord | null): ClientSettings {
  if (!record) {
    return normalizeClientSettings();
  }

  return normalizeClientSettings({
    answerStyle: record.answer_style,
    showConfidence: record.show_confidence,
    detectionMode: record.default_detection_mode,
    lowCreditNotifications: record.low_credit_notifications,
    theme: record.theme_preference,
    language: record.language,
  });
}

export async function getClientSettingsByUserId(userId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('client_settings')
    .select(
      'user_id, answer_style, show_confidence, default_detection_mode, low_credit_notifications, theme_preference, language, created_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load client settings.');

  if (!data) {
    return ensureClientSettingsByUserId(userId);
  }

  return mapRecordToSettings(parseSingle(data, clientSettingsRecordSchema, 'Client settings row is invalid.'));
}

export async function ensureClientSettingsByUserId(userId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  const defaults = normalizeClientSettings();
  const { data, error } = await supabase
    .from('client_settings')
    .upsert(
      {
        user_id: userId,
        answer_style: defaults.answerStyle,
        show_confidence: defaults.showConfidence,
        default_detection_mode: defaults.detectionMode,
        low_credit_notifications: defaults.lowCreditNotifications,
        theme_preference: defaults.theme,
        language: defaults.language,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      },
    )
    .select(
      'user_id, answer_style, show_confidence, default_detection_mode, low_credit_notifications, theme_preference, language, created_at, updated_at',
    )
    .single();

  assertSupabaseResult(error, 'Failed to initialize client settings.');
  return mapRecordToSettings(parseSingle(data, clientSettingsRecordSchema, 'Client settings row is invalid.'));
}

export async function updateClientSettingsByUserId(userId: string, settings: ClientSettings): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeClientSettings(settings);
  const { data, error } = await supabase
    .from('client_settings')
    .upsert(
      {
        user_id: userId,
        answer_style: normalized.answerStyle,
        show_confidence: normalized.showConfidence,
        default_detection_mode: normalized.detectionMode,
        low_credit_notifications: normalized.lowCreditNotifications,
        theme_preference: normalized.theme,
        language: normalized.language,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      },
    )
    .select(
      'user_id, answer_style, show_confidence, default_detection_mode, low_credit_notifications, theme_preference, language, created_at, updated_at',
    )
    .single();

  assertSupabaseResult(error, 'Failed to update client settings.');
  return mapRecordToSettings(parseSingle(data, clientSettingsRecordSchema, 'Client settings row is invalid.'));
}
