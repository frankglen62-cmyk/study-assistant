import { env } from '@/lib/env/server';
import { RouteError, getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { processExpiredWalletGrants, restoreElapsedSuspensions } from '@/lib/supabase/users';

export const runtime = 'nodejs';

function assertCronAuthorized(request: Request) {
  const expectedSecret = env.CRON_SECRET;

  if (!expectedSecret) {
    throw new RouteError(500, 'cron_misconfigured', 'CRON_SECRET environment variable is not set.');
  }

  const authorization = request.headers.get('authorization');

  if (authorization !== `Bearer ${expectedSecret}`) {
    throw new RouteError(401, 'cron_unauthorized', 'Cron authorization failed.');
  }
}

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    assertCronAuthorized(request);

    const [restoredSuspensions, expiredWallets] = await Promise.all([
      restoreElapsedSuspensions(env.MAINTENANCE_BATCH_LIMIT),
      processExpiredWalletGrants(env.MAINTENANCE_BATCH_LIMIT),
    ]);

    await Promise.all([
      ...restoredSuspensions.map((entry) =>
        writeAuditLog({
          actorRole: 'super_admin',
          eventType: 'profile.status_auto_restored',
          entityType: 'profiles',
          entityId: entry.user_id,
          eventSummary: `Automatically restored suspension for ${entry.email}.`,
          oldValues: {
            accountStatus: 'suspended',
            reason: entry.previous_reason ?? null,
          },
          newValues: {
            accountStatus: 'active',
            source: 'maintenance_cron',
          },
          userAgent: 'cron:user-maintenance',
        }),
      ),
      ...expiredWallets.map((entry) =>
        writeAuditLog({
          actorRole: 'super_admin',
          eventType: 'wallet.expired_grants_processed',
          entityType: 'wallets',
          entityId: entry.wallet_id,
          eventSummary: `Expired ${entry.expired_seconds} seconds from wallet ${entry.wallet_id}.`,
          oldValues: {
            expiredGrantCount: entry.expired_grant_count,
          },
          newValues: {
            expiredSeconds: entry.expired_seconds,
            remainingSeconds: entry.remaining_seconds,
            source: 'maintenance_cron',
          },
          userAgent: 'cron:user-maintenance',
        }),
      ),
    ]);

    return jsonOk(
      {
        restoredSuspensions: restoredSuspensions.length,
        expiredWallets: expiredWallets.length,
        expiredSecondsTotal: expiredWallets.reduce((sum, entry) => sum + entry.expired_seconds, 0),
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
