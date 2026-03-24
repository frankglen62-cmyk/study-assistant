'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const current = navItems.find((item) => item.href === pathname);

  useEffect(() => {
    const routesToPrefetch = navItems
      .map((item) => item.href)
      .filter((href) => href !== pathname);

    if (!routesToPrefetch.length) {
      return;
    }

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const prefetchRoutes = () => {
      if (cancelled) {
        return;
      }

      for (const href of routesToPrefetch) {
        router.prefetch(href as any);
      }
    };

    if (typeof globalThis.requestIdleCallback === 'function') {
      idleHandle = globalThis.requestIdleCallback(prefetchRoutes, { timeout: 1200 });
    } else {
      timeoutHandle = globalThis.setTimeout(prefetchRoutes, 120);
    }

    return () => {
      cancelled = true;

      if (typeof idleHandle === 'number' && typeof globalThis.cancelIdleCallback === 'function') {
        globalThis.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [navItems, pathname, router]);

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
