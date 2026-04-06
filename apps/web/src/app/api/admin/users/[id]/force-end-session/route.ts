import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { updateOpenSessionsStatusForUser } from '@/lib/supabase/sessions';
import { getProfileWithWalletByUserId } from '@/lib/supabase/users';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const { id: targetUserId } = await params;
    assertRateLimit(`admin-force-end:${context.userId}`, { max: 60, windowMs: 60 * 60 * 1000 });

    // Validate target user exists
    const target = await getProfileWithWalletByUserId(targetUserId);

    // Close all open sessions for this user
    const result = await updateOpenSessionsStatusForUser({
      userId: targetUserId,
      status: 'ended',
    });

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'session.admin_force_ended',
      entityType: 'sessions',
      entityId: targetUserId,
      eventSummary: `Admin force-ended ${result.count} session(s) for ${target.profile.email}.`,
      newValues: {
        sessionsClosed: result.count,
        targetUserId,
        targetEmail: target.profile.email,
      },
      ipAddress,
      userAgent,
    });

    return jsonOk(
      {
        success: true,
        sessionsClosed: result.count,
        message:
          result.count > 0
            ? `${result.count} active session${result.count === 1 ? '' : 's'} ended successfully.`
            : 'No active sessions found for this user.',
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
