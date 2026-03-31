import { Button, Card } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { SessionManager } from '@/features/client/session-manager';
import { requirePageUser } from '@/lib/auth/page-context';
import { getClientPortalOverview, getClientSessionsTableData } from '@/features/client/server';

export default async function SessionsPage() {
  const context = await requirePageUser(['client']);
  const [overview, sessions] = await Promise.all([
    getClientPortalOverview(context.userId),
    getClientSessionsTableData(context.userId),
  ]);

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Activity"
        title="Study Sessions"
        description="Review your active session, recent usage history, and credit consumption details."
      />

      <SessionManager
        initialSession={
          overview.openSession
            ? {
                id: overview.openSession.id,
                status: overview.openSession.status,
                startTime: overview.openSession.start_time,
                detectionMode: overview.openSession.detection_mode,
              }
            : null
        }
        remainingSeconds={context.wallet.remaining_seconds}
      />

      <div className="space-y-6 pt-12">
        <h3 className="font-display text-3xl font-black uppercase text-black border-l-8 border-accent pl-4">Recent Sessions</h3>
        <DataTable
          columns={['Date', 'Duration', 'Subject', 'Category', 'Credits Used', 'Status', 'Action']}
          emptyMessage="No historical sessions found."
          rows={sessions.map((session) => [
            session.date,
            session.duration,
            session.subject,
            session.category,
            session.creditsUsed,
            <StatusBadge key={`${session.id}-status`} status={session.status} />,
            <Button key={`${session.id}-action`} variant="secondary" size="sm" className="font-black tracking-widest uppercase">
              Details
            </Button>,
          ])}
        />
      </div>
    </div>
  );
}
