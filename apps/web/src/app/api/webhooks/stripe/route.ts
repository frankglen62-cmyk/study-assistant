import { RouteError, getRequestMeta, jsonError, jsonOk, readRequestText } from '@/lib/http/route';
import { handleStripeWebhook } from '@/lib/payments/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      throw new RouteError(400, 'missing_webhook_signature', 'Stripe signature header is required.');
    }

    const rawBody = await readRequestText(request, { maxBytes: 1024 * 1024 });
    const response = await handleStripeWebhook(rawBody, signature);
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
