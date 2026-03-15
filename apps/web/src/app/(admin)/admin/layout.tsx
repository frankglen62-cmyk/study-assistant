import type { ReactNode } from 'react';
import { PortalLayoutClient } from '@/components/layout/portal-layout-client';
import { adminNavItems } from '@/lib/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalLayoutClient role="admin" navItems={adminNavItems}>
      {children}
    </PortalLayoutClient>
  );
}
