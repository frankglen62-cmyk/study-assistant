import { PricingPageClient } from '@/features/public/pricing-page-client';
import { listPublishedPaymentPackageDisplays } from '@/lib/payments/package-catalog';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const pricingPackages = await listPublishedPaymentPackageDisplays();

  return <PricingPageClient packages={pricingPackages} />;
}
