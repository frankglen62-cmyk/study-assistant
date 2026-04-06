import type { ReactNode } from 'react';
import { PortalLayoutClient } from '@/components/layout/portal-layout-client';
import { adminNavItems } from '@/lib/navigation';
import { requirePageUser } from '@/lib/auth/page-context';
import { getUserPreferences } from '@/lib/supabase/user-preferences';
import { ScopedThemeProvider } from '@/components/providers/scoped-theme-provider';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await requirePageUser(['admin', 'super_admin']);
  const preferences = await getUserPreferences(context.userId);
  const adminBanner = context.systemSettings.maintenanceMode
    ? `Maintenance mode is enabled. Client portal and extension access are currently paused. ${context.systemSettings.systemBanner.trim()}`.trim()
    : context.systemSettings.systemBanner.trim() || null;

  return (
    <ScopedThemeProvider initialTheme={preferences.appearance_mode}>
      <PortalLayoutClient role="admin" navItems={adminNavItems} systemBanner={adminBanner}>
        {children}
      </PortalLayoutClient>
    </ScopedThemeProvider>
  );
}
