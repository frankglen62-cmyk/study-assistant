import { z } from 'zod';

import type { PaymentCheckoutRequest } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { RouteError, getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { createTopupCheckout } from '@/lib/payments/service';
import { assertRateLimit } from '@/lib/security/rate-limit';
import { getUserAccessOverrideByUserId } from '@/lib/supabase/users';

const requestSchema = z.object({
  packageId: z.string().uuid(),
  provider: z.enum(['stripe', 'paymongo']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client']);
    assertRateLimit(`checkout:${context.userId}`, { max: 20, windowMs: 60 * 60 * 1000 });
    const accessOverride = await getUserAccessOverrideByUserId(context.userId);

    if (accessOverride?.can_buy_credits === false) {
      throw new RouteError(403, 'credit_purchases_disabled', 'Credit purchases are disabled for this account.');
    }

    const body = await parseJsonBody<PaymentCheckoutRequest>(request, requestSchema);
    const response = await createTopupCheckout({
      userId: context.userId,
      email: context.profile.email,
      fullName: context.profile.full_name,
      packageId: body.packageId,
      provider: body.provider,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
