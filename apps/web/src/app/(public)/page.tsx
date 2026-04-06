import { HomePageClient } from '@/features/public/home-page-client';
import { listPublishedPaymentPackageDisplays } from '@/lib/payments/package-catalog';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const pricingPackages = await listPublishedPaymentPackageDisplays();

  return <HomePageClient pricingPackages={pricingPackages} />;
}
