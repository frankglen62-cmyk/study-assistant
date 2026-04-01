import 'server-only';

import { getSupabaseAdmin } from './server';

export interface UserPreferencesRecord {
  user_id: string;
  appearance_mode: 'light' | 'dark' | 'system';
  created_at?: string;
  updated_at?: string;
}

export async function getUserPreferences(
  userId: string,
): Promise<UserPreferencesRecord> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found, create default 'system'
      return upsertUserPreferences(userId, { appearance_mode: 'system' });
    }
    throw error;
  }

  return data as unknown as UserPreferencesRecord;
}

export async function upsertUserPreferences(
  userId: string,
  updates: Partial<Pick<UserPreferencesRecord, 'appearance_mode'>>,
): Promise<UserPreferencesRecord> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...updates,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as UserPreferencesRecord;
}
