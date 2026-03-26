import { RouteError } from '@/lib/http/route';

import { getSupabaseAdmin } from './server';
import { profileRecordSchema, walletRecordSchema, type ProfileRecord, type WalletRecord } from './schemas';
import { assertSupabaseResult, parseSingle } from './utils';

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

export async function getProfileByUserId(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, account_status, email_2fa_enabled')
    .eq('id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load profile.');

  if (!data) {
    throw new RouteError(404, 'profile_not_found', 'Profile not found.');
  }

  return parseSingle(data, profileRecordSchema, 'Profile record is invalid.');
}

export async function getWalletByUserId(userId: string) {
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

export async function getProfileWithWalletByUserId(userId: string): Promise<ProfileWithWallet> {
  const [profile, wallet] = await Promise.all([getProfileByUserId(userId), getWalletByUserId(userId)]);
  return { profile, wallet };
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
