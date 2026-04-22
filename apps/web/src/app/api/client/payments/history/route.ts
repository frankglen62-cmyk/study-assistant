import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_READ } from '@/lib/security/rate-limit';
import { getPaymentHistory } from '@/lib/payments/service';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client']);
    assertRateLimit(`payment-history:${context.userId}`, RL_CLIENT_READ);
    const response = await getPaymentHistory(context.userId);
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
