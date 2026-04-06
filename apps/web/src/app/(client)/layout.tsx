import type { ReactNode } from 'react';
import { PortalLayoutClient } from '@/components/layout/portal-layout-client';
import { clientNavItems } from '@/lib/navigation';
import { requirePageUser } from '@/lib/auth/page-context';
import { getUserPreferences } from '@/lib/supabase/user-preferences';
import { ScopedThemeProvider } from '@/components/providers/scoped-theme-provider';

import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ClientAnnouncements } from '@/features/client/client-announcements';

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const context = await requirePageUser(['client']);
  const preferences = await getUserPreferences(context.userId);
  const banner = context.systemSettings.systemBanner.trim() || null;

  // Fetch unread announcements
  const supabase = getSupabaseAdmin();
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, message, tone')
    .eq('user_id', context.userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  return (
    <ScopedThemeProvider initialTheme={preferences.appearance_mode}>
      <PortalLayoutClient role="client" navItems={clientNavItems} systemBanner={banner}>
        {notifications && notifications.length > 0 && (
          <ClientAnnouncements announcements={notifications} />
        )}
        {children}
      </PortalLayoutClient>
    </ScopedThemeProvider>
  );
}
