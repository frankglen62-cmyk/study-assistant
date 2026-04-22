import { z } from 'zod';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { assertRateLimit, RL_ADMIN_READ } from '@/lib/security/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';

const broadcastSchema = z.object({
  title: z.string().trim().min(3, 'Title is required.').max(120),
  message: z.string().trim().min(5, 'Message body is required.').max(1000),
  tone: z.enum(['info', 'success', 'warning', 'danger']).default('info'),
});

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-announce:${context.userId}`, { max: 20, windowMs: 60 * 60 * 1000 });

    const body = await parseJsonBody(request, broadcastSchema);
    const supabase = getSupabaseAdmin();

    // Fetch all active client user IDs
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'client')
      .eq('account_status', 'active');

    assertSupabaseResult(profilesError, 'Failed to load client profiles.');

    const now = new Date().toISOString();
    const rows = (profiles ?? []).map((p) => ({
      user_id: p.id,
      title: body.title,
      message: body.message,
      tone: body.tone,
      is_read: false,
      created_at: now,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('notifications').insert(rows);
      assertSupabaseResult(insertError, 'Failed to insert notifications.');
    }

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'announcement.broadcast',
      entityType: 'notifications',
      entityId: 'broadcast',
      eventSummary: `Broadcast announcement "${body.title}" to ${rows.length} clients.`,
      newValues: { title: body.title, tone: body.tone, recipientCount: rows.length },
      ipAddress,
      userAgent,
    });

    return jsonOk(
      {
        success: true,
        recipientCount: rows.length,
        message: `Announcement sent to ${rows.length} active client${rows.length === 1 ? '' : 's'}.`,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    assertRateLimit(`admin-announcements:${context.userId}`, RL_ADMIN_READ);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, tone, created_at, is_read')
      .order('created_at', { ascending: false })
      .limit(50);

    assertSupabaseResult(error, 'Failed to load announcements.');

    return jsonOk({ announcements: data ?? [] }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
