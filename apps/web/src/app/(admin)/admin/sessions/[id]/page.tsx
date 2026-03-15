import Link from 'next/link';

import { Badge, Button, Card } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminLiveRefresh } from '@/features/admin/admin-live-refresh';
import { getAdminSessionDetailPageData } from '@/features/admin/server';

export const dynamic = 'force-dynamic';

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(['admin', 'super_admin']);
  const { id } = await params;
  const data = await getAdminSessionDetailPageData(id);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Session Details"
        title={data.session.userName}
        badge={data.session.status}
        description="This page is the detailed audit trail for one billed extension session, including site usage, subject detection changes, analyze attempts, and wallet debit history."
        actions={
          <>
            <Badge tone="accent">{data.session.creditsUsed} billed</Badge>
            <AdminLiveRefresh />
            <Link href={`/admin/users/${data.session.userId}/sessions`}>
              <Button variant="secondary">Back to User Sessions</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <Card className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Client</p>
              <p className="mt-2 font-semibold">{data.user.name}</p>
              <p className="text-xs text-muted-foreground">{data.user.email}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Site</p>
              <p className="mt-2 font-semibold">{data.session.siteDomain}</p>
              <p className="text-xs text-muted-foreground">{data.session.pagePath}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Detected Subject</p>
              <p className="mt-2 font-semibold">{data.session.subject}</p>
              <p className="text-xs text-muted-foreground">{data.session.category ?? 'No category recorded'}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Wallet</p>
              <p className="mt-2 font-semibold">{data.user.walletBalance} left</p>
              <p className="text-xs text-muted-foreground">{`${data.session.analyzeCount} analyze attempt${data.session.analyzeCount === 1 ? '' : 's'}`}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Started</p>
              <p className="mt-2 font-semibold">{data.session.startedAt}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ended</p>
              <p className="mt-2 font-semibold">{data.session.endedAt ?? 'Still open'}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Billed Time</p>
              <p className="mt-2 font-semibold">{data.session.creditsUsed}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-surface/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Signals</p>
              <p className="mt-2 font-semibold">{data.session.suspiciousFlag}</p>
              <p className="text-xs text-muted-foreground">{`${data.session.noMatchCount} no-match event${data.session.noMatchCount === 1 ? '' : 's'}`}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Why Session Exists</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>A session is the billing and audit envelope for extension usage.</p>
            <p>It groups multiple analyze attempts under one start/end window.</p>
            <p>Wallet debits tied to this session show how much paid time was consumed.</p>
            <p>Subject and category changes reveal what academic context the extension used while that paid time was being spent.</p>
          </div>
          <StatusBadge status={data.session.status} />
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Page History</p>
          <p className="text-sm text-muted-foreground">Every page or path seen in this session through analyze attempts.</p>
        </div>
        <DataTable
          columns={['Page', 'First Seen', 'Hits']}
          emptyMessage="No page history was recorded for this session."
          rows={data.pageHistory.map((entry) => [
            <div key={`${entry.url}-page`} className="space-y-1">
              <p className="font-medium">{entry.title}</p>
              <p className="text-xs text-muted-foreground break-all">{entry.url}</p>
            </div>,
            entry.firstSeenAt,
            String(entry.hits),
          ])}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.18em] text-accent">Subject / Category Timeline</p>
            <p className="text-sm text-muted-foreground">How the extension's academic context changed across attempts.</p>
          </div>
          <DataTable
            columns={['Time', 'Subject', 'Category']}
            emptyMessage="No subject timeline has been recorded for this session."
            rows={data.subjectHistory.map((entry) => [entry.createdAt, entry.subject, entry.category ?? 'No category'])}
          />
        </Card>

        <Card className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.18em] text-accent">Debit Timeline</p>
            <p className="text-sm text-muted-foreground">Wallet entries tied to this session.</p>
          </div>
          <DataTable
            columns={['Time', 'Type', 'Amount', 'Balance After', 'Description']}
            emptyMessage="No wallet transactions are linked to this session yet."
            rows={data.debitTimeline.map((entry) => [
              entry.createdAt,
              `${entry.transactionType} (${entry.direction})`,
              entry.delta,
              entry.balanceAfter,
              entry.description,
            ])}
          />
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Attempt History</p>
          <p className="text-sm text-muted-foreground">Every analyze attempt recorded inside this session.</p>
        </div>
        <DataTable
          columns={['When', 'Page', 'Subject', 'Confidence', 'Result']}
          emptyMessage="No analyze attempts were recorded for this session."
          rows={data.attempts.map((attempt) => [
            attempt.createdAt,
            <div key={`${attempt.id}-page`} className="space-y-1">
              <p className="font-medium">{attempt.pageTitle}</p>
              <p className="text-xs text-muted-foreground break-all">{attempt.pageUrl}</p>
            </div>,
            <div key={`${attempt.id}-subject`} className="space-y-1">
              <p className="font-medium">{attempt.subject}</p>
              <p className="text-xs text-muted-foreground">{attempt.category ?? 'No category'}</p>
            </div>,
            attempt.confidence,
            <div key={`${attempt.id}-result`} className="space-y-1">
              <p className="font-medium">{attempt.noMatchReason ? 'No match' : 'Matched'}</p>
              <p className="text-xs text-muted-foreground">
                {attempt.noMatchReason ?? attempt.answerPreview ?? 'Answer stored without preview'}
              </p>
            </div>,
          ])}
        />
      </Card>
    </div>
  );
}
