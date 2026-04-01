import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';
import { Activity, AlertTriangle, FileText, ShieldCheck, Users, TrendingUp } from 'lucide-react';

import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminDashboardPageData } from '@/features/admin/server';

export default async function AdminDashboardPage() {
  await requirePageUser(['admin', 'super_admin']);
  const dashboard = await getAdminDashboardPageData();

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge tone="accent">System Overview</Badge>
          <h1 className="font-display text-3xl text-foreground lg:text-4xl">
            Platform Dashboard
          </h1>
          <p className="text-muted-foreground max-w-xl">
            Monitor usage, processing health, credit sales, and subject adoption.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/sources"><FileText className="h-4 w-4" /> Manage Sources</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/users"><Users className="h-4 w-4" /> View Users</Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border/40 bg-background p-5 shadow-card transition-all duration-300 hover:shadow-card-hover">
            <p className="text-xs font-medium text-muted-foreground mb-3">{metric.label}</p>
            <p className="text-3xl font-semibold text-foreground">{metric.value}</p>
            {metric.delta && (
              <p className={`mt-3 text-xs font-medium flex items-center gap-1.5 ${metric.tone === 'accent' ? 'text-accent' : metric.tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {metric.delta}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <Activity className="h-4 w-4 text-accent" />
              </div>
              <div>
                <CardTitle>System Activity</CardTitle>
                <CardDescription>Operational events worth attention.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.recentActivity.length === 0 ? (
              <div className="rounded-xl bg-surface/50 p-8 text-center text-sm text-muted-foreground">
                No recent activity recorded.
              </div>
            ) : (
              dashboard.recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl p-3 text-sm text-foreground/80 transition-colors hover:bg-surface/50">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Telemetry */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle>Telemetry Snapshot</CardTitle>
                <CardDescription>Detection, processing & routing health.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-4 transition-colors hover:bg-surface/80">
                <p className="text-xs font-medium text-muted-foreground mb-2">Failed Detections</p>
                <p className="text-2xl font-semibold text-foreground">{`${Math.round(dashboard.lowConfidenceRate * 100)}%`}</p>
                {dashboard.lowConfidenceRate > 0.15 && (
                  <Badge tone="danger" className="mt-3"><AlertTriangle className="h-3 w-3" />Threshold Break</Badge>
                )}
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-4 transition-colors hover:bg-surface/80">
                <p className="text-xs font-medium text-muted-foreground mb-2">Source Failures</p>
                <p className="text-2xl font-semibold text-foreground">{dashboard.sourceFailures}</p>
                {dashboard.sourceFailures === 0 && (
                  <Badge tone="success" className="mt-3"><ShieldCheck className="h-3 w-3" />Optimal</Badge>
                )}
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-4 transition-colors hover:bg-surface/80">
                <p className="text-xs font-medium text-muted-foreground mb-2">Primary Subject</p>
                <p className="text-lg font-semibold text-foreground leading-tight break-words">{dashboard.mostUsedSubject || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-4 transition-colors hover:bg-surface/80">
                <p className="text-xs font-medium text-muted-foreground mb-2">Webhook Queue</p>
                <p className="text-2xl font-semibold text-foreground">0</p>
                <Badge tone="success" className="mt-3"><ShieldCheck className="h-3 w-3" />Synchronized</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
