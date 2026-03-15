import { RouteError, getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { handlePaymongoWebhook } from '@/lib/payments/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const signature = request.headers.get('paymongo-signature') ?? request.headers.get('Paymongo-Signature');
    if (!signature) {
      throw new RouteError(400, 'missing_webhook_signature', 'PayMongo signature header is required.');
    }

    const rawBody = await request.text();
    const response = await handlePaymongoWebhook(rawBody, signature);
    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
