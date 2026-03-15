import { Button } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminAuditLogsPageData } from '@/features/admin/server';

export default async function AdminAuditLogsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const logs = await getAdminAuditLogsPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Traceability"
        title="Audit Logs"
        description="Filter sensitive mutations by actor, entity, and event type to support operational review and incident response."
        actions={
          <>
            <Button variant="secondary">Event Type Filter</Button>
            <Button variant="secondary">Actor Filter</Button>
          </>
        }
      />
      <DataTable
        columns={['Time', 'Actor', 'Event', 'Entity', 'Summary']}
        emptyMessage="No audit log events have been recorded yet."
        rows={logs.map((log) => [
          log.createdAt,
          <div key={`${log.id}-actor`} className="space-y-1">
            <p className="font-medium">{log.actor}</p>
            <p className="text-xs text-muted-foreground">{log.actorDetail}</p>
          </div>,
          log.event,
          log.entity,
          log.summary,
        ])}
      />
    </div>
  );
}
