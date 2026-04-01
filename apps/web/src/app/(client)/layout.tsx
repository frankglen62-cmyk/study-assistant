import type { ReactNode } from 'react';
import { PortalLayoutClient } from '@/components/layout/portal-layout-client';
import { clientNavItems } from '@/lib/navigation';
import { requirePageUser } from '@/lib/auth/page-context';
import { getUserPreferences } from '@/lib/supabase/user-preferences';
import { ScopedThemeProvider } from '@/components/providers/scoped-theme-provider';

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const context = await requirePageUser(['client']);
  const preferences = await getUserPreferences(context.userId);

  return (
    <ScopedThemeProvider initialTheme={preferences.appearance_mode}>
      <PortalLayoutClient role="client" navItems={clientNavItems}>
        {children}
      </PortalLayoutClient>
    </ScopedThemeProvider>
  );
}
