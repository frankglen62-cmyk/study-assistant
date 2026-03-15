import { Badge } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminSessionsOverviewPageData } from '@/features/admin/server';
import { AdminLiveRefresh } from '@/features/admin/admin-live-refresh';
import { AdminSessionsConsole } from '@/features/admin/admin-sessions-console';

export const dynamic = 'force-dynamic';

export default async function AdminSessionsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const data = await getAdminSessionsOverviewPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Monitoring"
        title="Sessions"
        description="This page shows billed extension usage windows. Clients only appear in the session table after they actually start a session. Newly registered clients with no usage yet are listed separately below."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="accent">{`Updated ${data.lastRefreshedAt}`}</Badge>
            <AdminLiveRefresh />
          </div>
        }
      />
      <AdminSessionsConsole
        metrics={data.metrics}
        sessions={data.sessions}
        usersWithoutSessions={data.usersWithoutSessions}
      />
    </div>
  );
}
