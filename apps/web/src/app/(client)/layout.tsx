import type { ReactNode } from 'react';
import { PortalLayoutClient } from '@/components/layout/portal-layout-client';
import { clientNavItems } from '@/lib/navigation';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PortalLayoutClient role="client" navItems={clientNavItems}>
      {children}
    </PortalLayoutClient>
  );
}
