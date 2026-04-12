import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';
import { z } from 'zod';

const reviewPaymentSchema = z.object({
  paymentId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { requestId, ipAddress, userAgent } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['admin', 'super_admin']);
    const body = await parseJsonBody(request, reviewPaymentSchema);
    assertRateLimit(`admin-payment-review:${context.userId}`, { max: 120, windowMs: 60 * 60 * 1000 });

    // Verify payment exists
    const supabase = getSupabaseAdmin();
    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, user_id, amount_minor, currency, status, provider, provider_payment_id')
      .eq('id', body.paymentId)
      .maybeSingle();

    assertSupabaseResult(error, 'Failed to load payment.');

    if (!payment) {
      return jsonError(new Error('Payment not found.'), requestId);
    }

    // Write audit log entry for the review action
    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: context.profile.role,
      eventType: 'payment.admin_reviewed',
      entityType: 'payments',
      entityId: body.paymentId,
      eventSummary: `Admin reviewed payment ${body.paymentId} (${payment.provider} / ${payment.status} / ${payment.currency} ${(payment.amount_minor / 100).toFixed(2)}).`,
      newValues: {
        paymentId: body.paymentId,
        provider: payment.provider,
        providerPaymentId: payment.provider_payment_id,
        status: payment.status,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
      },
      ipAddress,
      userAgent,
    });

    return jsonOk(
      {
        success: true,
        message: `Payment ${body.paymentId.slice(0, 8)}... marked as reviewed. Entry added to audit trail.`,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId);
  }
}
