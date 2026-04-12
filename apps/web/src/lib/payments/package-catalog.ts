import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';

import { listActivePaymentPackages } from '@/lib/supabase/payments';

import { buildPaymentPackageDisplay } from './package-display';

export async function listPublishedPaymentPackageDisplays() {
  noStore();

  const packages = await listActivePaymentPackages();
  const featuredIndex = packages.length > 1 ? 1 : 0;

  return packages.map((entry, index) =>
    buildPaymentPackageDisplay(
      {
        id: entry.id,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        secondsToCredit: entry.seconds_to_credit,
        amountMinor: entry.amount_minor,
        currency: entry.currency,
        creditExpiresAfterDays: entry.credit_expires_after_days ?? null,
      },
      { featured: index === featuredIndex },
    ),
  );
}
