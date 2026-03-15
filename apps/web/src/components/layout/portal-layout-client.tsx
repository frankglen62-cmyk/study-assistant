'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { NavItem, UserRole } from '@study-assistant/shared-types';

import { PortalShell } from '@/components/layout/portal-shell';

export function PortalLayoutClient({
  role,
  navItems,
  children,
}: {
  role: UserRole;
  navItems: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = navItems.find((item) => item.href === pathname);

  return (
    <PortalShell
      role={role}
      navItems={navItems}
      currentPath={pathname}
      title={current?.label ?? (role === 'client' ? 'Client Portal' : 'Admin Portal')}
    >
      {children}
    </PortalShell>
  );
}
