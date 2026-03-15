import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';

export async function writeAuditLog(entry: {
  actorUserId?: string | null;
  actorRole?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  eventSummary: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('audit_logs').insert({
    actor_user_id: entry.actorUserId ?? null,
    actor_role: entry.actorRole ?? null,
    event_type: entry.eventType,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    event_summary: entry.eventSummary,
    old_values: entry.oldValues ?? null,
    new_values: entry.newValues ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });

  assertSupabaseResult(error, 'Failed to write audit log.');
}
