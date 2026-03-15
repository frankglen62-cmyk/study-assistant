import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/public-shell';
import { publicNavItems } from '@/lib/navigation';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <PublicShell navItems={publicNavItems}>{children}</PublicShell>;
}
