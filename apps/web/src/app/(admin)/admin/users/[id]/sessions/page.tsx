import Link from 'next/link';

import { Badge, Button, Card } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminLiveRefresh } from '@/features/admin/admin-live-refresh';
import { AdminUserSessionsAudit } from '@/features/admin/admin-user-sessions-audit';
import { getAdminUserSessionsPageData } from '@/features/admin/server';

export const dynamic = 'force-dynamic';

export default async function AdminUserSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(['admin', 'super_admin']);
  const { id } = await params;
  const data = await getAdminUserSessionsPageData(id);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="User Sessions"
        title={data.user.name}
        badge={data.user.role === 'client' ? 'Client usage audit' : 'Portal usage audit'}
        description="A session is one billed usage window. It records when the client used the extension, which site/domain they used it on, what subject was detected, and how much wallet time was consumed."
        actions={
          <>
            <Badge tone="accent">{data.user.walletBalance} remaining</Badge>
            <AdminLiveRefresh label="Live refresh every 15s" />
            <Link href="/admin/users">
              <Button variant="secondary">Back to Users</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-[0.18em] text-accent">Client context</p>
              <h3 className="text-xl font-semibold tracking-tight">{data.user.email}</h3>
              <p className="text-sm text-muted-foreground">
                Status: {data.user.accountStatus} | Wallet: {data.user.walletStatus}
              </p>
            </div>
            <StatusBadge status={data.user.accountStatus} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <div key={metric.label} className="rounded-3xl border border-border/70 bg-surface/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.delta}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">What This Page Shows</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>`Site` shows where the session happened, so admin can audit domain usage.</p>
            <p>`Subject` is the academic context the extension detected and used for retrieval.</p>
            <p>`Billed Time` is the wallet time consumed for that session, which is the same unit used for credit billing.</p>
            <p>`Category` is only a sub-context like quiz, reviewer, or practice. It stays secondary to the subject.</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-surface/60 p-4 text-sm">
            <p className="font-medium">Summary</p>
            <p className="mt-2 text-muted-foreground">Top site: {data.summary.topSite}</p>
            <p className="text-muted-foreground">Top subject: {data.summary.topSubject}</p>
            <p className="text-muted-foreground">{data.summary.uniqueSites} site(s) used in these sessions</p>
            <p className="text-muted-foreground">{data.summary.uniqueSubjects} subject(s) detected in these sessions</p>
          </div>
        </Card>
      </div>

      <AdminUserSessionsAudit
        userId={data.user.id}
        userName={data.user.name}
        sessions={data.sessions}
      />
    </div>
  );
}
