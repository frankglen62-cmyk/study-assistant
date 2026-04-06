import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/public-shell';
import { publicNavItems } from '@/lib/navigation';
import { getSystemSettings } from '@/lib/platform/system-settings';

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const settings = await getSystemSettings();
  const banner = settings.maintenanceMode
    ? settings.maintenanceMessage
    : settings.systemBanner.trim() || null;

  return <PublicShell navItems={publicNavItems} systemBanner={banner}>{children}</PublicShell>;
}
