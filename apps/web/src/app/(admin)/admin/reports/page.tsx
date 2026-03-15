import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/metric-card';
import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminReportsPageData } from '@/features/admin/server';

export default async function AdminReportsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const reports = await getAdminReportsPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Analytics"
        title="Reports"
        description="Review usage trends, subject popularity, package sales, and confidence/no-match movement."
      />
      <div className="grid gap-6 xl:grid-cols-4">
        {reports.metrics.map((item) => (
          <MetricCard key={item.label} label={item.label} value={item.value} delta={item.delta} tone={item.tone} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage highlights</CardTitle>
            <CardDescription>Server-backed operational signals from sessions, attempts, and sources.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reports.usageHighlights.map((item) => (
              <div key={item} className="rounded-[22px] border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment highlights</CardTitle>
            <CardDescription>Snapshot of recent provider outcomes and operational follow-up needs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reports.paymentHighlights.map((item) => (
              <div key={item} className="rounded-[22px] border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <DataTable
        columns={['Time', 'Subject', 'Category', 'Confidence', 'Outcome']}
        emptyMessage="No report findings are available yet."
        rows={reports.recentFindings.map((finding) => [
          finding.createdAt,
          finding.subject,
          finding.category,
          finding.confidence,
          finding.noMatchReason,
        ])}
      />
    </div>
  );
}
