import { RouteError } from '@/lib/http/route';

import {
  installationRecordSchema,
  pairingCodeRecordSchema,
  refreshTokenRecordSchema,
  type InstallationRecord,
  type PairingCodeRecord,
  type RefreshTokenRecord,
} from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseSingle } from './utils';

export async function createPairingCode(params: {
  userId: string;
  codeHash: string;
  expiresAt: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_pairing_codes')
    .insert({
      user_id: params.userId,
      code_hash: params.codeHash,
      expires_at: params.expiresAt,
      created_by: params.createdBy ?? null,
      metadata: params.metadata ?? {},
    })
    .select('id, user_id, code_hash, expires_at, used_at')
    .single();

  assertSupabaseResult(error, 'Failed to create pairing code.');
  return parseSingle(data, pairingCodeRecordSchema, 'Pairing code record is invalid.');
}

export async function consumePairingCode(codeHash: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_pairing_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', codeHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id, user_id, code_hash, expires_at, used_at')
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to consume pairing code.');

  if (!data) {
    throw new RouteError(400, 'pairing_code_invalid', 'Pairing code is invalid or expired.');
  }

  return parseSingle(data, pairingCodeRecordSchema, 'Consumed pairing code is invalid.');
}

export async function assignPairingCodeInstallation(pairingCodeId: string, installationId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('extension_pairing_codes')
    .update({ used_by_installation_id: installationId })
    .eq('id', pairingCodeId);

  assertSupabaseResult(error, 'Failed to update pairing code installation.');
}

export async function findActiveInstallation(params: {
  userId: string;
  deviceName: string;
  browserName: string;
}): Promise<InstallationRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .select('id, user_id, installation_status, device_name, browser_name, extension_version, last_seen_at')
    .eq('user_id', params.userId)
    .eq('device_name', params.deviceName)
    .eq('browser_name', params.browserName)
    .eq('installation_status', 'active')
    .order('last_seen_at', { ascending: false })
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to search for existing installation.');

  return data ? parseSingle(data, installationRecordSchema, 'Installation record is invalid.') : null;
}

export async function reactivateInstallation(params: {
  installationId: string;
  extensionVersion: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .update({
      installation_status: 'active',
      extension_version: params.extensionVersion,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', params.installationId)
    .select('id, user_id, installation_status, device_name, browser_name, extension_version, last_seen_at')
    .single();

  assertSupabaseResult(error, 'Failed to reactivate installation.');
  return parseSingle(data, installationRecordSchema, 'Reactivated installation record is invalid.');
}

export async function createInstallation(params: {
  userId: string;
  deviceName: string;
  browserName: string;
  extensionVersion: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .insert({
      user_id: params.userId,
      device_name: params.deviceName,
      browser_name: params.browserName,
      extension_version: params.extensionVersion,
      installation_status: 'active',
      last_seen_at: new Date().toISOString(),
    })
    .select('id, user_id, installation_status, device_name, browser_name, extension_version, last_seen_at')
    .single();

  assertSupabaseResult(error, 'Failed to create extension installation.');
  return parseSingle(data, installationRecordSchema, 'Installation record is invalid.');
}

export async function getInstallationById(installationId: string): Promise<InstallationRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .select('id, user_id, installation_status, device_name, browser_name, extension_version, last_seen_at')
    .eq('id', installationId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load extension installation.');

  if (!data) {
    throw new RouteError(401, 'installation_not_found', 'Extension installation was not found.');
  }

  return parseSingle(data, installationRecordSchema, 'Installation record is invalid.');
}

export async function touchInstallation(installationId: string, extensionVersion?: string | null) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('extension_installations')
    .update({
      last_seen_at: new Date().toISOString(),
      ...(extensionVersion ? { extension_version: extensionVersion } : {}),
    })
    .eq('id', installationId);

  assertSupabaseResult(error, 'Failed to update installation activity.');
}

export async function storeRefreshToken(params: { installationId: string; tokenHash: string; expiresAt: string }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_tokens')
    .insert({
      installation_id: params.installationId,
      token_hash: params.tokenHash,
      expires_at: params.expiresAt,
    })
    .select('id, installation_id, token_hash, expires_at, revoked_at')
    .single();

  assertSupabaseResult(error, 'Failed to store extension refresh token.');
  return parseSingle(data, refreshTokenRecordSchema, 'Refresh token record is invalid.');
}

export async function revokeRefreshToken(tokenId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('extension_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId);

  assertSupabaseResult(error, 'Failed to revoke refresh token.');
}

export async function getRefreshTokenRecord(installationId: string, tokenHash: string): Promise<RefreshTokenRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_tokens')
    .select('id, installation_id, token_hash, expires_at, revoked_at')
    .eq('installation_id', installationId)
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load refresh token.');

  if (!data) {
    throw new RouteError(401, 'refresh_token_invalid', 'Refresh token is invalid or expired.');
  }

  return parseSingle(data, refreshTokenRecordSchema, 'Refresh token record is invalid.');
}

export async function revokeInstallation(installationId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .update({ installation_status: 'revoked' })
    .eq('id', installationId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to revoke installation.');

  if (!data) {
    throw new RouteError(404, 'installation_not_found', 'Extension installation not found.');
  }

  const tokenResult = await supabase
    .from('extension_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('installation_id', installationId)
    .is('revoked_at', null);

  assertSupabaseResult(tokenResult.error, 'Failed to revoke installation tokens.');
}

export async function listInstallationsForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .select('id, user_id, installation_status, device_name, browser_name, extension_version, last_seen_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  assertSupabaseResult(error, 'Failed to load extension installations.');

  return (data ?? []).map((row) => parseSingle(row, installationRecordSchema, 'Installation row is invalid.'));
}

export async function revokeAllInstallationsForUser(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  // Revoke all active installations
  const { data, error } = await supabase
    .from('extension_installations')
    .update({ installation_status: 'revoked' })
    .eq('user_id', userId)
    .eq('installation_status', 'active')
    .select('id');

  assertSupabaseResult(error, 'Failed to revoke all installations.');

  const revokedIds = (data ?? []).map((row) => row.id);

  // Also revoke all tokens for those installations
  if (revokedIds.length > 0) {
    for (const installId of revokedIds) {
      const tokenResult = await supabase
        .from('extension_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('installation_id', installId)
        .is('revoked_at', null);

      assertSupabaseResult(tokenResult.error, 'Failed to revoke installation tokens.');
    }
  }

  return revokedIds.length;
}
