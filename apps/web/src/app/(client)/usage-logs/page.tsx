import { Button } from '@study-assistant/ui';
import { Download, Filter } from 'lucide-react';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { requirePageUser } from '@/lib/auth/page-context';
import { getClientSessionsTableData } from '@/features/client/server';

export default async function UsageLogsPage() {
  const context = await requirePageUser(['client']);
  const entries = await getClientSessionsTableData(context.userId);

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Usage"
        title="Usage Logs"
        description="Filter your own attempts by date, subject, and status, then export your history if needed."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"><Filter className="w-4 h-4" /> Filter</Button>
            <Button size="sm"><Download className="w-4 h-4" /> Export CSV</Button>
          </div>
        }
      />
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground">Attempt History</h3>
        <DataTable
          columns={['Date', 'Subject', 'Category', 'Duration', 'Status']}
          emptyMessage="No usage logs found for the selected filters."
          rows={entries.map((entry) => [
            entry.date,
            entry.subject,
            entry.category,
            entry.duration,
            <StatusBadge key={`${entry.id}-status`} status={entry.status} />,
          ])}
        />
      </div>
    </div>
  );
}
