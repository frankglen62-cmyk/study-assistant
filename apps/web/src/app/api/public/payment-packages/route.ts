import type { PublicPaymentPackagesResponse } from '@study-assistant/shared-types';

import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { listPublishedPaymentPackageDisplays } from '@/lib/payments/package-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const packages = await listPublishedPaymentPackageDisplays();

    const response: PublicPaymentPackagesResponse = {
      packages: packages.map((entry) => ({
        id: entry.id,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        secondsToCredit: entry.secondsToCredit,
        minutesToCredit: entry.minutesToCredit,
        amountMinor: entry.amountMinor,
        currency: entry.currency,
        priceDisplay: entry.price,
        durationLabel: entry.durationLabel,
        durationSummary: entry.durationSummary,
        hasDistinctName: entry.hasDistinctName,
        creditExpiresAfterDays: entry.creditExpiresAfterDays,
      })),
    };

    return jsonOk(response, requestId, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
