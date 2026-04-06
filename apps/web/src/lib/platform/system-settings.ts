import 'server-only';

import type { UserRole } from '@study-assistant/shared-types';

import { RouteError } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';
import {
  defaultSystemSettings,
  type SystemSettings,
  systemSettingsSchema,
} from './system-settings-schema';

const SYSTEM_SETTINGS_KEY = 'platform_configuration';

function sanitizeStoredValue(value: unknown): SystemSettings {
  const parsed = systemSettingsSchema.safeParse({
    ...defaultSystemSettings,
    ...(typeof value === 'object' && value !== null ? value : {}),
  });

  if (parsed.success) {
    return parsed.data;
  }

  return defaultSystemSettings;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', SYSTEM_SETTINGS_KEY)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load system settings.');

  if (!data?.value) {
    return defaultSystemSettings;
  }

  return sanitizeStoredValue(data.value);
}

export async function updateSystemSettings(params: {
  settings: SystemSettings;
  actorUserId: string;
  actorRole: UserRole;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (params.actorRole === 'client') {
    throw new RouteError(403, 'insufficient_role', 'Client users cannot update platform settings.');
  }

  const previous = await getSystemSettings();
  const next = systemSettingsSchema.parse(params.settings);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('system_settings').upsert(
    {
      key: SYSTEM_SETTINGS_KEY,
      value: next,
      updated_by: params.actorUserId,
    },
    {
      onConflict: 'key',
    },
  );

  assertSupabaseResult(error, 'Failed to save system settings.');

  await writeAuditLog({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    eventType: 'system_settings.updated',
    entityType: 'system_settings',
    entityId: SYSTEM_SETTINGS_KEY,
    eventSummary: `Updated platform settings for ${next.platformName}.`,
    oldValues: previous,
    newValues: next,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return next;
}

export function isMaintenanceBlockedForRole(role: UserRole, settings: SystemSettings) {
  return settings.maintenanceMode && role === 'client';
}

export async function assertMaintenanceAccess(params: {
  role: UserRole;
  target: 'portal_page' | 'portal_api' | 'extension';
}) {
  const settings = await getSystemSettings();

  if (!isMaintenanceBlockedForRole(params.role, settings)) {
    return settings;
  }

  if (params.target === 'portal_page') {
    return settings;
  }

  throw new RouteError(503, 'maintenance_mode', settings.maintenanceMessage, {
    maintenanceMode: true,
    maintenanceMessage: settings.maintenanceMessage,
    supportEmail: settings.supportEmail,
  });
}
