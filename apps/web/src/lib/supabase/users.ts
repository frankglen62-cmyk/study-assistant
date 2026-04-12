import { RouteError } from '@/lib/http/route';

import { getSupabaseAdmin } from './server';
import {
  profileRecordSchema,
  userAccessOverrideRecordSchema,
  walletRecordSchema,
  walletGrantRecordSchema,
  type ProfileRecord,
  type UserAccessOverrideRecord,
  type WalletGrantRecord,
  type WalletRecord,
} from './schemas';
import { assertSupabaseResult, parseArray, parseSingle } from './utils';

const accountStatusMutationSchema = walletRecordSchema.pick({
  user_id: true,
}).extend({
  account_status: profileRecordSchema.shape.account_status,
  wallet_status: walletRecordSchema.shape.status,
});

export interface ProfileWithWallet {
  profile: ProfileRecord;
  wallet: WalletRecord;
}

async function maybeRestoreExpiredSuspension(profile: ProfileRecord): Promise<ProfileRecord> {
  if (
    profile.account_status !== 'suspended' ||
    !profile.suspended_until ||
    new Date(profile.suspended_until).getTime() > Date.now()
  ) {
    return profile;
  }

  await setUserAccountStatusAtomic({
    userId: profile.id,
    accountStatus: 'active',
    walletStatus: 'active',
  });

  const supabase = getSupabaseAdmin();
  const clearedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      suspended_until: null,
      status_changed_at: clearedAt,
    })
    .eq('id', profile.id);

  assertSupabaseResult(error, 'Failed to clear expired suspension.');

  return {
    ...profile,
    account_status: 'active' as const,
    suspended_until: null,
    status_changed_at: clearedAt,
  };
}

export async function getProfileByUserId(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, account_status, email_2fa_enabled, status_reason, status_changed_at, status_changed_by, suspended_until, created_at')
    .eq('id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load profile.');

  if (!data) {
    throw new RouteError(404, 'profile_not_found', 'Profile not found.');
  }

  return maybeRestoreExpiredSuspension(parseSingle(data, profileRecordSchema, 'Profile record is invalid.'));
}

export async function getWalletByUserId(userId: string) {
  await expireWalletGrantsForUser(userId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wallets')
    .select('id, user_id, remaining_seconds, lifetime_seconds_purchased, lifetime_seconds_used, status')
    .eq('user_id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load wallet.');

  if (!data) {
    throw new RouteError(404, 'wallet_not_found', 'Wallet not found.');
  }

  return parseSingle(data, walletRecordSchema, 'Wallet record is invalid.');
}

export async function expireWalletGrantsForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('expire_wallet_grants_for_user', {
    p_user_id: userId,
  });

  assertSupabaseResult(error, 'Failed to expire wallet grants.');
}

export async function getProfileWithWalletByUserId(userId: string): Promise<ProfileWithWallet> {
  const profile = await getProfileByUserId(userId);
  const wallet = await getWalletByUserId(userId);
  return { profile, wallet };
}

export async function getUserAccessOverrideByUserId(userId: string): Promise<UserAccessOverrideRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_access_overrides')
    .select(`
      user_id,
      can_use_extension,
      can_buy_credits,
      max_active_devices,
      daily_usage_limit_seconds,
      monthly_usage_limit_seconds,
      feature_flags,
      updated_by,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load user access override.');
  return data ? parseSingle(data, userAccessOverrideRecordSchema, 'User access override is invalid.') : null;
}

export async function listWalletGrantsForUser(userId: string, limit = 12): Promise<WalletGrantRecord[]> {
  await expireWalletGrantsForUser(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wallet_grants')
    .select(`
      id,
      user_id,
      wallet_id,
      source_transaction_id,
      grant_type,
      total_seconds,
      remaining_seconds,
      expires_at,
      description,
      metadata,
      created_by,
      created_at,
      updated_at,
      depleted_at,
      expired_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load wallet grants.');
  return parseArray(data ?? [], walletGrantRecordSchema, 'Wallet grant rows are invalid.');
}

export async function getWalletGrantOverviewForUser(userId: string) {
  await expireWalletGrantsForUser(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wallet_grants')
    .select('remaining_seconds, expires_at, expired_at')
    .eq('user_id', userId)
    .gt('remaining_seconds', 0)
    .is('expired_at', null)
    .not('expires_at', 'is', null)
    .order('expires_at', { ascending: true });

  assertSupabaseResult(error, 'Failed to load wallet grant overview.');

  const rows = (data ?? []) as Array<{
    remaining_seconds: number;
    expires_at: string | null;
    expired_at: string | null;
  }>;
  const nextExpiryAt = rows[0]?.expires_at ?? null;
  const expiringSeconds = rows.reduce((sum, row) => sum + row.remaining_seconds, 0);

  return {
    nextExpiryAt,
    expiringSeconds,
  };
}

export async function restoreElapsedSuspensions(limit = 200) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('restore_elapsed_suspensions', {
    p_limit: limit,
  });

  assertSupabaseResult(error, 'Failed to restore elapsed suspensions.');
  return (data ?? []) as Array<{
    user_id: string;
    email: string;
    previous_reason: string | null;
  }>;
}

export async function processExpiredWalletGrants(limit = 200) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('process_expired_wallet_grants', {
    p_limit: limit,
  });

  assertSupabaseResult(error, 'Failed to process expired wallet grants.');
  return (data ?? []) as Array<{
    user_id: string;
    wallet_id: string;
    expired_seconds: number;
    remaining_seconds: number;
    expired_grant_count: number;
  }>;
}

export async function setUserAccountStatusAtomic(params: {
  userId: string;
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'banned';
  walletStatus: 'active' | 'locked';
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc('set_user_account_status', {
      p_user_id: params.userId,
      p_account_status: params.accountStatus,
      p_wallet_status: params.walletStatus,
    })
    .single();

  assertSupabaseResult(error, 'Failed to update account status.');
  return accountStatusMutationSchema.parse(data);
}
