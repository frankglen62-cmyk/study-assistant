import type { PublicPaymentPackagesResponse } from '@study-assistant/shared-types';

import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { listActivePaymentPackages } from '@/lib/supabase/payments';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const packages = await listActivePaymentPackages();

    const response: PublicPaymentPackagesResponse = {
      packages: packages.map((entry) => ({
        id: entry.id,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        secondsToCredit: entry.seconds_to_credit,
        amountMinor: entry.amount_minor,
        currency: entry.currency,
      })),
    };

    return jsonOk(response, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
